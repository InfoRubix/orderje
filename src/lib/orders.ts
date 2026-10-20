import "server-only";
import { and, asc, eq, inArray, sql, sum } from "drizzle-orm";
import { db } from "@/db";
import {
  categories,
  customers,
  diningTables,
  menuItems,
  modifierGroups,
  modifierOptions,
  orderItems,
  orders,
  payments,
  tenants,
  type CustomerType,
  type OrderType,
  type PaymentMethod,
  type Tenant,
} from "@/db/schema";
import { computeTotals } from "./pricing";
import { cashRound } from "./money";
import { appUrl, token, uid } from "./utils";
import { createBill, isBillPaid, toyyibpayReady } from "./toyyibpay";

export class OrderError extends Error {}

/* ---------------------------------- Menu ---------------------------------- */

export async function loadMenu(tenantId: string, opts: { includeUnavailable?: boolean } = {}) {
  const [cats, items, groups, options] = await Promise.all([
    db.select().from(categories).where(eq(categories.tenantId, tenantId)).orderBy(asc(categories.sort), asc(categories.name)),
    db.select().from(menuItems).where(eq(menuItems.tenantId, tenantId)).orderBy(asc(menuItems.sort), asc(menuItems.name)),
    db.select().from(modifierGroups).where(eq(modifierGroups.tenantId, tenantId)).orderBy(asc(modifierGroups.sort)),
    db.select().from(modifierOptions).where(eq(modifierOptions.tenantId, tenantId)).orderBy(asc(modifierOptions.sort)),
  ]);
  const groupsByItem = new Map<string, (typeof groups[number] & { options: typeof options })[]>();
  for (const g of groups) {
    const list = groupsByItem.get(g.menuItemId) ?? [];
    list.push({ ...g, options: options.filter((o) => o.groupId === g.id) });
    groupsByItem.set(g.menuItemId, list);
  }
  return cats
    .map((c) => ({
      ...c,
      items: items
        .filter((i) => i.categoryId === c.id && (opts.includeUnavailable || i.available))
        .map((i) => ({ ...i, groups: groupsByItem.get(i.id) ?? [] })),
    }))
    .filter((c) => opts.includeUnavailable || c.items.length > 0);
}

export type Menu = Awaited<ReturnType<typeof loadMenu>>;
export type MenuItemFull = Menu[number]["items"][number];

/* --------------------------------- Orders --------------------------------- */

export type OrderLineInput = { menuItemId: string; qty: number; optionIds: string[]; note?: string };

export type CreateOrderInput = {
  tenantId: string;
  source: "qr" | "counter";
  orderType: OrderType;
  tableId?: string | null;
  customerType?: CustomerType;
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  note?: string | null;
  lines: OrderLineInput[];
};

/** Prices every line from the database, never from the client. */
async function priceLines(tenantId: string, lines: OrderLineInput[]) {
  if (!lines.length) throw new OrderError("Add at least one item.");
  if (lines.length > 100) throw new OrderError("Too many items in one order.");
  const itemIds = [...new Set(lines.map((l) => l.menuItemId))];
  const items = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.tenantId, tenantId), inArray(menuItems.id, itemIds)));
  const groups = items.length
    ? await db.select().from(modifierGroups).where(inArray(modifierGroups.menuItemId, items.map((i) => i.id)))
    : [];
  const opts = groups.length
    ? await db.select().from(modifierOptions).where(inArray(modifierOptions.groupId, groups.map((g) => g.id)))
    : [];

  return lines.map((l) => {
    const item = items.find((i) => i.id === l.menuItemId);
    if (!item) throw new OrderError("An item in your cart is no longer on the menu.");
    if (!item.available) throw new OrderError(`${item.name} is sold out.`);
    const qty = Math.trunc(l.qty);
    if (!(qty >= 1 && qty <= 99)) throw new OrderError("Quantity must be between 1 and 99.");

    const chosen = [...new Set(l.optionIds)].map((id) => {
      const o = opts.find((x) => x.id === id);
      const g = o && groups.find((x) => x.id === o.groupId && x.menuItemId === item.id);
      if (!o || !g) throw new OrderError(`An add-on for ${item.name} is no longer available.`);
      return { o, g };
    });
    for (const g of groups.filter((x) => x.menuItemId === item.id)) {
      const n = chosen.filter((c) => c.g.id === g.id).length;
      if (g.required && n === 0) throw new OrderError(`Choose ${g.name} for ${item.name}.`);
      if (n > g.maxSelect) throw new OrderError(`Pick up to ${g.maxSelect} for ${g.name}.`);
    }
    const unitPrice = item.price + chosen.reduce((s, c) => s + c.o.price, 0);
    return {
      menuItemId: item.id,
      name: item.name,
      modifiers: chosen.map((c) => c.o.name).join(", ").slice(0, 255) || null,
      note: l.note?.trim().slice(0, 160) || null,
      unitPrice,
      qty,
      lineTotal: unitPrice * qty,
    };
  });
}

async function resolveCustomer(tenantId: string, type: CustomerType, customerId?: string | null) {
  if (type === "walk_in") return null;
  if (!customerId) throw new OrderError(`Pick which ${type} this order belongs to.`);
  const [c] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenantId)))
    .limit(1);
  if (!c || !c.active) throw new OrderError("Customer not found.");
  if (c.type !== type) throw new OrderError(`${c.name} is registered as ${c.type}, not ${type}.`);
  return c;
}

export async function createOrder(input: CreateOrderInput) {
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, input.tenantId)).limit(1);
  if (!tenant || !tenant.active) throw new OrderError("This kedai is not taking orders right now.");

  let table: typeof diningTables.$inferSelect | undefined;
  if (input.orderType === "dine_in" && input.tableId) {
    [table] = await db
      .select()
      .from(diningTables)
      .where(and(eq(diningTables.id, input.tableId), eq(diningTables.tenantId, tenant.id)))
      .limit(1);
    if (!table || !table.active) throw new OrderError("This table QR is no longer active. Ask the counter.");
  }

  const customerType = input.customerType ?? "walk_in";
  const customer = await resolveCustomer(tenant.id, customerType, input.customerId);
  const lines = await priceLines(tenant.id, input.lines);
  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);
  const totals = computeTotals(tenant, subtotal, customerType, input.orderType);

  const orderId = uid();
  const publicToken = token(20);

  await db.transaction(async (tx) => {
    await tx.update(tenants).set({ orderSeq: sql`${tenants.orderSeq} + 1` }).where(eq(tenants.id, tenant.id));
    const [{ seq }] = await tx
      .select({ seq: tenants.orderSeq })
      .from(tenants)
      .where(eq(tenants.id, tenant.id));
    await tx.insert(orders).values({
      id: orderId,
      tenantId: tenant.id,
      orderNo: seq,
      publicToken,
      source: input.source,
      orderType: input.orderType,
      tableId: table?.id ?? null,
      tableLabel: table?.label ?? null,
      customerType,
      customerId: customer?.id ?? null,
      customerName: input.customerName?.trim().slice(0, 120) || customer?.name || null,
      customerPhone: input.customerPhone?.trim().slice(0, 32) || customer?.phone || null,
      note: input.note?.trim().slice(0, 255) || null,
      ...totals,
    });
    await tx.insert(orderItems).values(lines.map((l) => ({ id: uid(), tenantId: tenant.id, orderId, ...l })));
  });

  return { id: orderId, publicToken };
}

/** Re-applies discount/SST/service when the customer type changes at the counter. */
export async function setOrderCustomer(
  tenantId: string,
  orderId: string,
  customerType: CustomerType,
  customerId?: string | null,
) {
  const order = await getOrder(tenantId, orderId);
  if (!order) throw new OrderError("Order not found.");
  if (order.paymentStatus === "paid" || order.paymentStatus === "credit")
    throw new OrderError("This order is already settled.");
  if (order.paymentStatus === "pending")
    throw new OrderError("Confirm or reject the pending payment before changing the customer.");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId));
  const customer = await resolveCustomer(tenantId, customerType, customerId);
  const totals = computeTotals(tenant, order.subtotal, customerType, order.orderType);
  await db
    .update(orders)
    .set({
      customerType,
      customerId: customer?.id ?? null,
      customerName: customer?.name ?? (customerType === "walk_in" ? order.customerName : null),
      customerPhone: customer?.phone ?? order.customerPhone,
      ...totals,
      rounding: 0,
    })
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)));
}

/** Plain queries (no LATERAL joins) so this runs on MySQL 5.7/8, Aurora and MariaDB alike. */
async function withLines(order: typeof orders.$inferSelect | undefined) {
  if (!order) return undefined;
  const [items, pays] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db.select().from(payments).where(eq(payments.orderId, order.id)).orderBy(asc(payments.createdAt)),
  ]);
  return { ...order, items, payments: pays };
}

export async function getOrder(tenantId: string, orderId: string) {
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenantId)))
    .limit(1);
  return withLines(o);
}

export async function getOrderByToken(publicToken: string) {
  const [o] = await db.select().from(orders).where(eq(orders.publicToken, publicToken)).limit(1);
  return withLines(o);
}

/* -------------------------------- Payments -------------------------------- */

export async function outstandingCredit(tenantId: string, customerId: string) {
  const [charged] = await db
    .select({ v: sum(payments.amount) })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.customerId, customerId),
        eq(payments.method, "credit"),
        eq(payments.status, "success"),
      ),
    );
  const [settled] = await db
    .select({ v: sum(payments.amount) })
    .from(payments)
    .where(
      and(
        eq(payments.tenantId, tenantId),
        eq(payments.customerId, customerId),
        eq(payments.kind, "settlement"),
        eq(payments.status, "success"),
      ),
    );
  return Number(charged?.v ?? 0) - Number(settled?.v ?? 0);
}

export type PayInput = {
  tenant: Tenant;
  orderId: string;
  method: Exclude<PaymentMethod, "online">;
  tenderedSen?: number;
  reference?: string | null;
  userId: string;
};

/** Counter payments: cash, DuitNow QR (cashier confirms the bank notification) and corporate credit. */
export async function payAtCounter(p: PayInput) {
  const order = await getOrder(p.tenant.id, p.orderId);
  if (!order) throw new OrderError("Order not found.");
  if (order.status === "cancelled") throw new OrderError("This order was cancelled.");
  if (order.paymentStatus === "paid" || order.paymentStatus === "credit")
    throw new OrderError("This order is already settled.");

  let amount = order.total;
  let rounding = 0;
  let tendered: number | null = null;
  let changeGiven: number | null = null;
  let paymentStatus: "paid" | "credit" = "paid";

  if (p.method === "cash") {
    const rounded = cashRound(order.total);
    rounding = rounded - order.total;
    amount = rounded;
    tendered = p.tenderedSen ?? rounded;
    if (!Number.isFinite(tendered) || tendered < rounded) throw new OrderError("Cash received is less than the bill.");
    changeGiven = tendered - rounded;
  } else if (p.method === "duitnow_qr") {
    if (!p.reference?.trim()) throw new OrderError("Enter the last digits of the bank reference to confirm the QR payment.");
  } else if (p.method === "credit") {
    if (order.customerType !== "corporate" || !order.customerId)
      throw new OrderError("Credit is only for corporate customers. Set the customer type first.");
    const [c] = await db.select().from(customers).where(eq(customers.id, order.customerId));
    const owing = await outstandingCredit(p.tenant.id, order.customerId);
    if (c.creditLimit > 0 && owing + order.total > c.creditLimit)
      throw new OrderError(`${c.name} would exceed their credit limit.`);
    paymentStatus = "credit";
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    // Any pending online/QR attempt is superseded by the counter payment.
    await tx
      .update(payments)
      .set({ status: "failed" })
      .where(and(eq(payments.orderId, order.id), eq(payments.status, "pending")));
    await tx.insert(payments).values({
      id: uid(),
      tenantId: p.tenant.id,
      orderId: order.id,
      customerId: order.customerId,
      kind: "order",
      method: p.method,
      status: "success",
      amount,
      tendered,
      changeGiven,
      reference: p.reference?.trim().slice(0, 120) || null,
      receivedBy: p.userId,
      confirmedAt: now,
    });
    await tx
      .update(orders)
      .set({ paymentStatus, paidAt: now, rounding, total: order.total + rounding })
      .where(eq(orders.id, order.id));
  });
  return { changeGiven, amount };
}

/** Customer tapped "I've paid by DuitNow QR": parks a pending payment for the cashier to confirm. */
export async function declareQrPayment(publicToken: string) {
  const order = await getOrderByToken(publicToken);
  if (!order) throw new OrderError("Order not found.");
  if (order.paymentStatus !== "unpaid") return;
  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      id: uid(),
      tenantId: order.tenantId,
      orderId: order.id,
      kind: "order",
      method: "duitnow_qr",
      status: "pending",
      amount: order.total,
    });
    await tx.update(orders).set({ paymentStatus: "pending" }).where(eq(orders.id, order.id));
  });
}

/** Cashier confirms or rejects a pending QR / online payment. */
export async function resolvePendingPayment(
  tenantId: string,
  paymentId: string,
  ok: boolean,
  userId: string,
  reference?: string | null,
) {
  const [pay] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.tenantId, tenantId)))
    .limit(1);
  if (!pay || pay.status !== "pending" || !pay.orderId) throw new OrderError("Payment is no longer pending.");
  if (ok && pay.method === "duitnow_qr" && !reference?.trim())
    throw new OrderError("Enter the bank reference before confirming.");
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({
        status: ok ? "success" : "failed",
        confirmedAt: ok ? now : null,
        receivedBy: userId,
        reference: reference?.trim().slice(0, 120) || pay.reference,
      })
      .where(eq(payments.id, pay.id));
    await tx
      .update(orders)
      .set(ok ? { paymentStatus: "paid", paidAt: now } : { paymentStatus: "unpaid" })
      .where(eq(orders.id, pay.orderId!));
  });
}

/* ----------------------------- Online (gateway) ---------------------------- */


export async function startOnlinePayment(publicToken: string) {
  const order = await getOrderByToken(publicToken);
  if (!order) throw new OrderError("Order not found.");
  if (order.status === "cancelled") throw new OrderError("This order was cancelled.");
  if (order.paymentStatus === "paid" || order.paymentStatus === "credit") throw new OrderError("Already paid.");
  if (order.paymentStatus === "pending")
    throw new OrderError("A payment is already waiting for confirmation. Ask the counter if it doesn't clear.");
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, order.tenantId));
  if (!toyyibpayReady(tenant)) throw new OrderError("Online payment isn't set up for this kedai. Pay at the counter.");

  const paymentId = uid();
  const bill = await createBill(tenant, {
    amountSen: order.total,
    billName: `${tenant.name}`.slice(0, 30),
    description: `Order #${order.orderNo}${order.tableLabel ? ` ${order.tableLabel}` : ""}`,
    externalRef: paymentId,
    returnUrl: `${appUrl()}/api/pay/toyyibpay/return?o=${order.publicToken}`,
    callbackUrl: `${appUrl()}/api/pay/toyyibpay/callback`,
    payorName: order.customerName,
    payorPhone: order.customerPhone,
  });
  await db.transaction(async (tx) => {
    await tx.insert(payments).values({
      id: paymentId,
      tenantId: tenant.id,
      orderId: order.id,
      customerId: order.customerId,
      kind: "order",
      method: "online",
      status: "pending",
      amount: order.total,
      gatewayBillCode: bill.billCode,
    });
    await tx.update(orders).set({ paymentStatus: "pending" }).where(eq(orders.id, order.id));
  });
  return bill.paymentUrl;
}

/** Called from both the gateway callback and the return redirect; idempotent. */
export async function settleOnlinePayment(billCode: string) {
  const [pay] = await db.select().from(payments).where(eq(payments.gatewayBillCode, billCode)).limit(1);
  if (!pay || !pay.orderId) return { ok: false as const };
  if (pay.status === "success") return { ok: true as const, orderId: pay.orderId };
  if (pay.status !== "pending") return { ok: false as const };
  const [tenant] = await db.select().from(tenants).where(eq(tenants.id, pay.tenantId));
  const check = await isBillPaid(tenant, billCode, pay.amount);
  if (!check.paid) return { ok: false as const };
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(payments)
      .set({ status: "success", confirmedAt: now, reference: check.reference })
      .where(and(eq(payments.id, pay.id), eq(payments.status, "pending")));
    await tx.update(orders).set({ paymentStatus: "paid", paidAt: now }).where(eq(orders.id, pay.orderId!));
  });
  return { ok: true as const, orderId: pay.orderId };
}

/** Customer came back from the gateway without paying: free the order for another method. */
export async function abandonOnlinePayment(billCode: string) {
  const [pay] = await db.select().from(payments).where(eq(payments.gatewayBillCode, billCode)).limit(1);
  if (!pay || pay.status !== "pending" || !pay.orderId) return;
  await db.transaction(async (tx) => {
    await tx.update(payments).set({ status: "failed" }).where(eq(payments.id, pay.id));
    await tx
      .update(orders)
      .set({ paymentStatus: "unpaid" })
      .where(and(eq(orders.id, pay.orderId!), eq(orders.paymentStatus, "pending")));
  });
}

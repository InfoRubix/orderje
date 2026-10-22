import "server-only";
import { body, col, fs, read, readAll } from "@/db";
import type {
  Category,
  CustomerType,
  DiningTable,
  MenuItem,
  Order,
  OrderType,
  Payment,
  PaymentMethod,
  Tenant,
} from "@/db/schema";
import { computeTotals } from "./pricing";
import { UserError } from "./i18n";
import { cashRound } from "./money";
import { getCustomer, getTenant, listCategories } from "./repo";
import { token, uid } from "./utils";

/** A mistake the user can fix; English template + params so it can be shown in either language. */
export class OrderError extends UserError {}

/* ---------------------------------- Menu ---------------------------------- */

export async function listMenuItems(tenantId: string) {
  const items = readAll<MenuItem>(await col.of(tenantId, "menuItems").get());
  return items
    .map((i) => ({
      ...i,
      groups: [...(i.groups ?? [])]
        .sort((a, b) => a.sort - b.sort)
        .map((g) => ({ ...g, options: [...g.options].sort((a, b) => a.sort - b.sort) })),
    }))
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name));
}

export async function loadMenu(tenantId: string, opts: { includeUnavailable?: boolean } = {}) {
  const [cats, items] = await Promise.all([listCategories(tenantId), listMenuItems(tenantId)]);
  return cats
    .map((c: Category) => ({
      ...c,
      items: items.filter((i) => i.categoryId === c.id && (opts.includeUnavailable || i.available)),
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
  const snaps = await fs().getAll(...itemIds.map((id) => col.of(tenantId, "menuItems").doc(id)));
  const items = snaps.map((s) => read<MenuItem>(s)).filter((i): i is MenuItem => Boolean(i));

  return lines.map((l) => {
    const item = items.find((i) => i.id === l.menuItemId);
    if (!item) throw new OrderError("An item in your cart is no longer on the menu.");
    if (!item.available) throw new OrderError("{name} is sold out.", { name: item.name });
    const qty = Math.trunc(l.qty);
    if (!(qty >= 1 && qty <= 99)) throw new OrderError("Quantity must be between 1 and 99.");

    const groups = item.groups ?? [];
    const chosen = [...new Set(l.optionIds)].map((id) => {
      const g = groups.find((x) => x.options.some((o) => o.id === id));
      const o = g?.options.find((x) => x.id === id);
      if (!o || !g) throw new OrderError("An add-on for {name} is no longer available.", { name: item.name });
      return { o, g };
    });
    for (const g of groups) {
      const n = chosen.filter((c) => c.g.id === g.id).length;
      if (g.required && n === 0) throw new OrderError("Choose {group} for {name}.", { group: g.name, name: item.name });
      if (n > g.maxSelect) throw new OrderError("Pick up to {max} for {group}.", { max: g.maxSelect, group: g.name });
    }
    const unitPrice = item.price + chosen.reduce((s, c) => s + c.o.price, 0);
    return {
      id: uid(),
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
  // The type is part of the template (one per type) so the Malay can say it naturally.
  if (!customerId) throw new OrderError(`Pick which ${type} this order belongs to.`);
  const c = await getCustomer(tenantId, customerId);
  if (!c || !c.active) throw new OrderError("Customer not found.");
  if (c.type !== type) throw new OrderError(`{name} is registered as ${c.type}, not ${type}.`, { name: c.name });
  return c;
}

export async function createOrder(input: CreateOrderInput) {
  const tenant = await getTenant(input.tenantId);
  if (!tenant || !tenant.active) throw new OrderError("This kedai is not taking orders right now.");

  let table: DiningTable | undefined;
  if (input.orderType === "dine_in" && input.tableId) {
    table = read<DiningTable>(await col.of(tenant.id, "tables").doc(input.tableId).get());
    if (!table || !table.active) throw new OrderError("This table QR is no longer active. Ask the counter.");
  }

  const customerType = input.customerType ?? "walk_in";
  const customer = await resolveCustomer(tenant.id, customerType, input.customerId);
  const items = await priceLines(tenant.id, input.lines);
  const subtotal = items.reduce((s, l) => s + l.lineTotal, 0);
  const totals = computeTotals(tenant, subtotal, customerType, input.orderType);

  const orderId = uid();
  const publicToken = token(20);
  const tenantRef = col.tenants().doc(tenant.id);

  await fs().runTransaction(async (tx) => {
    const seq = Number((await tx.get(tenantRef)).get("orderSeq") ?? 0) + 1;
    tx.update(tenantRef, { orderSeq: seq });
    const order: Omit<Order, "id"> = {
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
      status: "new",
      paymentStatus: "unpaid",
      ...totals,
      rounding: 0,
      note: input.note?.trim().slice(0, 255) || null,
      items,
      createdAt: new Date(),
      paidAt: null,
    };
    tx.create(col.of(tenant.id, "orders").doc(orderId), order);
    tx.create(col.orderTokens().doc(publicToken), { tenantId: tenant.id, orderId });
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
  const tenant = (await getTenant(tenantId))!;
  const customer = await resolveCustomer(tenantId, customerType, customerId);
  const totals = computeTotals(tenant, order.subtotal, customerType, order.orderType);
  await col.of(tenantId, "orders").doc(orderId).update({
    customerType,
    customerId: customer?.id ?? null,
    customerName: customer?.name ?? (customerType === "walk_in" ? order.customerName : null),
    customerPhone: customer?.phone ?? order.customerPhone,
    ...totals,
    rounding: 0,
  });
}

async function orderPayments(tenantId: string, orderId: string) {
  const list = readAll<Payment>(await col.of(tenantId, "payments").where("orderId", "==", orderId).get());
  return list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
}

async function withPayments(order: Order | undefined) {
  if (!order) return undefined;
  return { ...order, payments: await orderPayments(order.tenantId, order.id) };
}

export async function getOrderRow(tenantId: string, orderId: string) {
  return read<Order>(await col.of(tenantId, "orders").doc(orderId).get());
}

export async function getOrder(tenantId: string, orderId: string) {
  return withPayments(await getOrderRow(tenantId, orderId));
}

export async function getOrderByToken(publicToken: string) {
  if (!publicToken || publicToken.includes("/")) return undefined;
  const ref = await col.orderTokens().doc(publicToken).get();
  if (!ref.exists) return undefined;
  return getOrder(String(ref.get("tenantId")), String(ref.get("orderId")));
}

/* -------------------------------- Payments -------------------------------- */

export async function outstandingCredit(tenantId: string, customerId: string) {
  const list = readAll<Payment>(await col.of(tenantId, "payments").where("customerId", "==", customerId).get());
  let owing = 0;
  for (const p of list) {
    if (p.status !== "success") continue;
    if (p.method === "credit") owing += p.amount;
    if (p.kind === "settlement") owing -= p.amount;
  }
  return owing;
}

function newPayment(p: Partial<Payment> & Pick<Payment, "tenantId" | "method" | "status" | "amount">): Omit<Payment, "id"> {
  return {
    orderId: null,
    customerId: null,
    kind: "order",
    tendered: null,
    changeGiven: null,
    reference: null,
    receivedBy: null,
    confirmedAt: null,
    createdAt: new Date(),
    ...body(p),
  };
}

export type PayInput = {
  tenant: Tenant;
  orderId: string;
  method: PaymentMethod;
  tenderedSen?: number;
  reference?: string | null;
  userId: string;
};

/** Counter payments: cash, DuitNow QR (cashier confirms the bank notification) and corporate credit. */
export async function payAtCounter(p: PayInput) {
  const order = await getOrderRow(p.tenant.id, p.orderId);
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
    const c = await getCustomer(p.tenant.id, order.customerId);
    if (!c) throw new OrderError("Customer not found.");
    const owing = await outstandingCredit(p.tenant.id, order.customerId);
    if (c.creditLimit > 0 && owing + order.total > c.creditLimit)
      throw new OrderError("{name} would exceed their credit limit.", { name: c.name });
    paymentStatus = "credit";
  }

  const now = new Date();
  const orderRef = col.of(p.tenant.id, "orders").doc(order.id);
  await fs().runTransaction(async (tx) => {
    const fresh = read<Order>(await tx.get(orderRef));
    if (!fresh || fresh.paymentStatus === "paid" || fresh.paymentStatus === "credit")
      throw new OrderError("This order is already settled.");
    if (fresh.status === "cancelled") throw new OrderError("This order was cancelled.");
    if (fresh.total !== order.total) throw new OrderError("The bill changed while you were paying. Check the total and try again.");
    tx.create(
      col.of(p.tenant.id, "payments").doc(uid()),
      newPayment({
        tenantId: p.tenant.id,
        orderId: order.id,
        customerId: order.customerId,
        method: p.method,
        status: "success",
        amount,
        tendered,
        changeGiven,
        reference: p.reference?.trim().slice(0, 120) || null,
        receivedBy: p.userId,
        confirmedAt: now,
        createdAt: now,
      }),
    );
    tx.update(orderRef, { paymentStatus, paidMethod: p.method, paidAt: now, rounding, total: order.total + rounding });
  });
  return { changeGiven, amount };
}

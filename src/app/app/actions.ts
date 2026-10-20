"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  categories,
  customers,
  diningTables,
  menuItems,
  modifierGroups,
  modifierOptions,
  orders,
  payments,
  reconciliations,
  tenants,
  users,
  type CustomerType,
  type OrderStatus,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  createOrder,
  OrderError,
  outstandingCredit,
  payAtCounter,
  resolvePendingPayment,
  setOrderCustomer,
} from "@/lib/orders";
import { reconSummary } from "@/lib/reports";
import { toSen } from "@/lib/money";
import { isValidDate, myDate } from "@/lib/time";
import { token, uid } from "@/lib/utils";

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

async function assertOpenToday(tenantId: string) {
  const [closed] = await db
    .select({ id: reconciliations.id })
    .from(reconciliations)
    .where(and(eq(reconciliations.tenantId, tenantId), eq(reconciliations.businessDate, myDate())))
    .limit(1);
  if (closed) throw new OrderError("Today is already closed in Recon. Ask the owner to reopen it before taking more payments.");
}

function fail(e: unknown): ActionResult {
  if (e instanceof OrderError) return { error: e.message };
  if (e instanceof z.ZodError) return { error: e.issues[0]?.message ?? "Check the form." };
  throw e;
}

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const bool = (f: FormData, k: string) => f.get(k) === "on" || f.get(k) === "true";
function sen(f: FormData, k: string, label: string, allowZero = true) {
  const v = toSen(str(f, k) || "0");
  if (!Number.isFinite(v) || v < 0 || (!allowZero && v === 0)) throw new OrderError(`Enter a valid amount for ${label}.`);
  return v;
}
function rate(f: FormData, k: string, label: string) {
  const n = Number(str(f, k) || "0");
  if (!Number.isFinite(n) || n < 0 || n > 100) throw new OrderError(`${label} must be between 0 and 100%.`);
  return Math.round(n * 100);
}

/* ------------------------------ Kitchen / orders ------------------------------ */

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "new", "cancelled"],
  ready: ["served", "preparing"],
  served: ["ready"],
  cancelled: [],
};

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<ActionResult> {
  const { user, tenant } = await requireUser(["owner", "cashier", "kitchen"]);
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)))
    .limit(1);
  if (!o) return { error: "Order not found." };
  if (!NEXT[o.status].includes(status)) return { error: `Can't move a ${o.status} order to ${status}.` };
  if (status === "cancelled") {
    if (user.role === "kitchen") return { error: "Only the counter can cancel orders." };
    if (o.paymentStatus === "paid" || o.paymentStatus === "credit")
      return { error: "This order is paid. Refund it at the counter first." };
  }
  await db.update(orders).set({ status }).where(eq(orders.id, o.id));
  if (status === "cancelled") {
    await db
      .update(payments)
      .set({ status: "failed" })
      .where(and(eq(payments.orderId, o.id), eq(payments.status, "pending")));
  }
  revalidatePath("/app/pos");
  revalidatePath(`/app/orders/${o.id}`);
  return { ok: true };
}

const counterOrderSchema = z.object({
  orderType: z.enum(["dine_in", "takeaway", "delivery"]),
  tableId: z.string().max(36).optional().nullable(),
  customerName: z.string().max(120).optional(),
  customerPhone: z.string().max(32).optional(),
  note: z.string().max(255).optional(),
  lines: z
    .array(
      z.object({
        menuItemId: z.string().max(36),
        qty: z.number().int().min(1).max(99),
        optionIds: z.array(z.string().max(36)).max(20),
        note: z.string().max(160).optional(),
      }),
    )
    .min(1, "Add at least one item.")
    .max(100),
});

export async function createCounterOrder(input: z.infer<typeof counterOrderSchema>): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner", "cashier"]);
  try {
    const d = counterOrderSchema.parse(input);
    if (d.orderType === "dine_in" && !d.tableId) return { error: "Pick a table for dine-in, or switch to takeaway." };
    const o = await createOrder({
      tenantId: tenant.id,
      source: "counter",
      orderType: d.orderType,
      tableId: d.orderType === "dine_in" ? d.tableId : null,
      customerName: d.customerName,
      customerPhone: d.customerPhone,
      note: d.note,
      lines: d.lines,
    });
    revalidatePath("/app/pos");
    return { ok: true, id: o.id };
  } catch (e) {
    return fail(e);
  }
}

export async function changeOrderCustomer(orderId: string, type: CustomerType, customerId: string | null): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner", "cashier"]);
  try {
    await setOrderCustomer(tenant.id, orderId, type, customerId);
    revalidatePath(`/app/orders/${orderId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function takePayment(
  orderId: string,
  method: "cash" | "duitnow_qr" | "credit",
  tendered: string,
  reference: string,
): Promise<{ ok?: boolean; error?: string; change?: number | null }> {
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  try {
    await assertOpenToday(tenant.id);
    const tSen = method === "cash" && tendered ? toSen(tendered) : undefined;
    if (tSen !== undefined && !Number.isFinite(tSen)) return { error: "Enter the cash received as a number, e.g. 20 or 20.50." };
    const r = await payAtCounter({ tenant, orderId, method, tenderedSen: tSen, reference, userId: user.id });
    revalidatePath(`/app/orders/${orderId}`);
    revalidatePath("/app/pos");
    return { ok: true, change: r.changeGiven };
  } catch (e) {
    return fail(e) ?? {};
  }
}

export async function confirmPending(paymentId: string, ok: boolean, reference: string): Promise<ActionResult> {
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  try {
    if (ok) await assertOpenToday(tenant.id);
    await resolvePendingPayment(tenant.id, paymentId, ok, user.id, reference);
    revalidatePath("/app/pos");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Reverses a paid order (refund handed back at the counter) so it can be cancelled or re-paid. */
export async function voidPayment(orderId: string, reason: string): Promise<ActionResult> {
  const { user, tenant } = await requireUser(["owner"]);
  if (!reason.trim()) return { error: "Give a reason for the void." };
  const [o] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.tenantId, tenant.id)))
    .limit(1);
  if (!o || (o.paymentStatus !== "paid" && o.paymentStatus !== "credit")) return { error: "Nothing to void." };
  const date = myDate(o.paidAt ?? o.createdAt);
  const [closed] = await db
    .select({ id: reconciliations.id })
    .from(reconciliations)
    .where(and(eq(reconciliations.tenantId, tenant.id), eq(reconciliations.businessDate, date)))
    .limit(1);
  if (closed) return { error: `${date} is already closed in Recon. Reopen that day first.` };
  await db.transaction(async (tx) => {
    const paid = await tx
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, o.id), eq(payments.status, "success")));
    for (const p of paid) {
      await tx
        .update(payments)
        .set({ status: "failed", reference: `VOID by ${user.name}: ${reason.trim()}`.slice(0, 120) })
        .where(eq(payments.id, p.id));
    }
    await tx
      .update(orders)
      .set({ paymentStatus: "unpaid", paidAt: null, total: o.total - o.rounding, rounding: 0 })
      .where(eq(orders.id, o.id));
  });
  revalidatePath(`/app/orders/${orderId}`);
  return { ok: true };
}

/* ---------------------------------- Menu ---------------------------------- */

export async function saveCategory(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const name = str(f, "name");
  if (!name) return { error: "Enter a category name." };
  const id = str(f, "id");
  if (id) {
    await db
      .update(categories)
      .set({ name, sort: Number(str(f, "sort") || 0) })
      .where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)));
  } else {
    const existing = await db.select({ id: categories.id }).from(categories).where(eq(categories.tenantId, tenant.id));
    await db.insert(categories).values({ id: uid(), tenantId: tenant.id, name, sort: existing.length });
  }
  revalidatePath("/app/menu");
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const items = await db
    .select({ id: menuItems.id })
    .from(menuItems)
    .where(and(eq(menuItems.categoryId, id), eq(menuItems.tenantId, tenant.id)))
    .limit(1);
  if (items.length) return { error: "Move or delete the items in this category first." };
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, tenant.id)));
  revalidatePath("/app/menu");
  return { ok: true };
}

export async function saveMenuItem(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  try {
    const name = str(f, "name");
    if (!name) return { error: "Enter the item name." };
    const categoryId = str(f, "categoryId");
    const [cat] = await db
      .select()
      .from(categories)
      .where(and(eq(categories.id, categoryId), eq(categories.tenantId, tenant.id)));
    if (!cat) return { error: "Pick a category." };
    const imageUrl = str(f, "imageUrl");
    if (imageUrl && !/^https:\/\//.test(imageUrl)) return { error: "Image link must start with https://" };
    const values = {
      name,
      categoryId,
      price: sen(f, "price", "price", false),
      description: str(f, "description").slice(0, 255) || null,
      imageUrl: imageUrl || null,
      available: bool(f, "available"),
    };
    const id = str(f, "id");
    if (id) {
      await db.update(menuItems).set(values).where(and(eq(menuItems.id, id), eq(menuItems.tenantId, tenant.id)));
      revalidatePath("/app/menu");
      return { ok: true, message: "Saved." };
    }
    const newId = uid();
    await db.insert(menuItems).values({ id: newId, tenantId: tenant.id, ...values, sort: 999 });
    revalidatePath("/app/menu");
    redirect(`/app/menu/${newId}`);
  } catch (e) {
    return fail(e);
  }
}

export async function toggleAvailable(id: string, available: boolean): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner", "cashier"]);
  await db.update(menuItems).set({ available }).where(and(eq(menuItems.id, id), eq(menuItems.tenantId, tenant.id)));
  revalidatePath("/app/menu");
  return { ok: true };
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const groups = await db
    .select({ id: modifierGroups.id })
    .from(modifierGroups)
    .where(and(eq(modifierGroups.menuItemId, id), eq(modifierGroups.tenantId, tenant.id)));
  if (groups.length) await db.delete(modifierOptions).where(inArray(modifierOptions.groupId, groups.map((g) => g.id)));
  await db.delete(modifierGroups).where(and(eq(modifierGroups.menuItemId, id), eq(modifierGroups.tenantId, tenant.id)));
  await db.delete(menuItems).where(and(eq(menuItems.id, id), eq(menuItems.tenantId, tenant.id)));
  revalidatePath("/app/menu");
  redirect("/app/menu");
}

/** Replaces all add-on groups for an item in one go (the editor sends the full structure). */
const groupsSchema = z
  .array(
    z.object({
      name: z.string().trim().min(1, "Every add-on group needs a name").max(80),
      required: z.boolean(),
      maxSelect: z.number().int().min(1).max(20),
      options: z
        .array(z.object({ name: z.string().trim().min(1, "Every option needs a name").max(80), price: z.string() }))
        .min(1, "Each add-on group needs at least one option")
        .max(30),
    }),
  )
  .max(10);

export async function saveModifiers(menuItemId: string, raw: unknown): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  try {
    const groups = groupsSchema.parse(raw);
    const [item] = await db
      .select()
      .from(menuItems)
      .where(and(eq(menuItems.id, menuItemId), eq(menuItems.tenantId, tenant.id)));
    if (!item) return { error: "Item not found." };
    for (const g of groups)
      for (const o of g.options) {
        const p = toSen(o.price || "0");
        if (!Number.isFinite(p) || p < 0) return { error: `Check the price for ${o.name}.` };
      }
    await db.transaction(async (tx) => {
      const old = await tx.select({ id: modifierGroups.id }).from(modifierGroups).where(eq(modifierGroups.menuItemId, item.id));
      if (old.length) await tx.delete(modifierOptions).where(inArray(modifierOptions.groupId, old.map((g) => g.id)));
      await tx.delete(modifierGroups).where(eq(modifierGroups.menuItemId, item.id));
      for (const [gi, g] of groups.entries()) {
        const groupId = uid();
        await tx.insert(modifierGroups).values({
          id: groupId,
          tenantId: tenant.id,
          menuItemId: item.id,
          name: g.name,
          required: g.required,
          maxSelect: g.maxSelect,
          sort: gi,
        });
        await tx.insert(modifierOptions).values(
          g.options.map((o, oi) => ({ id: uid(), tenantId: tenant.id, groupId, name: o.name, price: toSen(o.price || "0"), sort: oi })),
        );
      }
    });
    revalidatePath(`/app/menu/${item.id}`);
    return { ok: true, message: "Add-ons saved." };
  } catch (e) {
    return fail(e);
  }
}

/* --------------------------------- Tables --------------------------------- */

export async function addTables(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const count = Math.min(100, Math.max(1, Number(str(f, "count") || 1)));
  const prefix = str(f, "prefix") || "Meja";
  const existing = await db.select({ id: diningTables.id }).from(diningTables).where(eq(diningTables.tenantId, tenant.id));
  const start = existing.length + 1;
  await db.insert(diningTables).values(
    Array.from({ length: count }, (_, i) => ({
      id: uid(),
      tenantId: tenant.id,
      label: `${prefix} ${start + i}`.slice(0, 40),
      token: token(12),
      sort: start + i,
    })),
  );
  revalidatePath("/app/tables");
  return { ok: true };
}

export async function updateTable(id: string, patch: { label?: string; active?: boolean; regenerate?: boolean }): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const set: Partial<typeof diningTables.$inferInsert> = {};
  if (patch.label !== undefined) {
    if (!patch.label.trim()) return { error: "Table name can't be empty." };
    set.label = patch.label.trim().slice(0, 40);
  }
  if (patch.active !== undefined) set.active = patch.active;
  if (patch.regenerate) set.token = token(12);
  await db.update(diningTables).set(set).where(and(eq(diningTables.id, id), eq(diningTables.tenantId, tenant.id)));
  revalidatePath("/app/tables");
  return { ok: true };
}

/* -------------------------------- Customers -------------------------------- */

export async function saveCustomer(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner", "cashier"]);
  try {
    const type = str(f, "type");
    if (!["member", "staff", "corporate"].includes(type)) return { error: "Pick a customer type." };
    const name = str(f, "name");
    if (!name) return { error: "Enter a name." };
    const values = {
      type: type as "member" | "staff" | "corporate",
      name: name.slice(0, 120),
      phone: str(f, "phone").slice(0, 32) || null,
      company: str(f, "company").slice(0, 160) || null,
      creditLimit: type === "corporate" ? sen(f, "creditLimit", "credit limit") : 0,
      active: f.has("active") ? f.getAll("active").includes("on") : true,
    };
    const id = str(f, "id");
    if (id) await db.update(customers).set(values).where(and(eq(customers.id, id), eq(customers.tenantId, tenant.id)));
    else await db.insert(customers).values({ id: uid(), tenantId: tenant.id, ...values });
    revalidatePath("/app/customers");
    return { ok: true, message: id ? "Saved." : "Customer added." };
  } catch (e) {
    return fail(e);
  }
}

export async function settleCredit(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  try {
    await assertOpenToday(tenant.id);
    const customerId = str(f, "customerId");
    const method = str(f, "method") as "cash" | "duitnow_qr" | "online";
    if (!["cash", "duitnow_qr", "online"].includes(method)) return { error: "Pick how they paid." };
    const amount = sen(f, "amount", "amount", false);
    const [c] = await db
      .select()
      .from(customers)
      .where(and(eq(customers.id, customerId), eq(customers.tenantId, tenant.id)));
    if (!c || c.type !== "corporate") return { error: "Corporate customer not found." };
    const owing = await outstandingCredit(tenant.id, c.id);
    if (amount > owing) return { error: `They only owe ${(owing / 100).toFixed(2)}.` };
    await db.insert(payments).values({
      id: uid(),
      tenantId: tenant.id,
      customerId: c.id,
      kind: "settlement",
      method,
      status: "success",
      amount,
      reference: str(f, "reference").slice(0, 120) || null,
      receivedBy: user.id,
      confirmedAt: new Date(),
    });
    revalidatePath("/app/customers");
    return { ok: true, message: "Payment recorded." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------------------------- Staff ---------------------------------- */

export async function saveStaff(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { user: me, tenant } = await requireUser(["owner"]);
  const id = str(f, "id");
  const name = str(f, "name");
  const email = str(f, "email").toLowerCase();
  const role = str(f, "role");
  const password = str(f, "password");
  if (!name) return { error: "Enter a name." };
  if (!["owner", "cashier", "kitchen"].includes(role)) return { error: "Pick a role." };
  if (!z.string().email().safeParse(email).success) return { error: "Enter a valid email." };
  const [clash] = await db
    .select({ id: users.id })
    .from(users)
    .where(id ? and(eq(users.email, email), ne(users.id, id)) : eq(users.email, email))
    .limit(1);
  if (clash) return { error: "That email is already used by another account." };

  if (id) {
    if (id === me.id && role !== "owner") return { error: "You can't remove your own owner role." };
    const set: Partial<typeof users.$inferInsert> = { name, email, role: role as "owner" };
    if (password) {
      if (password.length < 8) return { error: "Password needs at least 8 characters." };
      set.passwordHash = await bcrypt.hash(password, 10);
    }
    await db.update(users).set(set).where(and(eq(users.id, id), eq(users.tenantId, tenant.id)));
  } else {
    if (password.length < 8) return { error: "Set a password of at least 8 characters." };
    await db.insert(users).values({
      id: uid(),
      tenantId: tenant.id,
      name,
      email,
      role: role as "owner",
      passwordHash: await bcrypt.hash(password, 10),
    });
  }
  revalidatePath("/app/staff");
  return { ok: true, message: id ? "Saved." : `${name} can now log in.` };
}

export async function setStaffActive(id: string, active: boolean): Promise<ActionResult> {
  const { user: me, tenant } = await requireUser(["owner"]);
  if (id === me.id) return { error: "You can't deactivate yourself." };
  await db.update(users).set({ active }).where(and(eq(users.id, id), eq(users.tenantId, tenant.id)));
  revalidatePath("/app/staff");
  return { ok: true };
}

/* -------------------------------- Settings -------------------------------- */

export async function saveSettings(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  try {
    const name = str(f, "name");
    if (!name) return { error: "Enter the kedai name." };
    const set: Partial<typeof tenants.$inferInsert> = {
      name,
      address: str(f, "address").slice(0, 255) || null,
      phone: str(f, "phone").slice(0, 32) || null,
      email: str(f, "email").slice(0, 160) || null,
      receiptFooter: str(f, "receiptFooter").slice(0, 255) || null,
      sstRate: rate(f, "sstRate", "SST"),
      serviceChargeRate: rate(f, "serviceChargeRate", "Service charge"),
      memberDiscountRate: rate(f, "memberDiscountRate", "Member discount"),
      staffDiscountRate: rate(f, "staffDiscountRate", "Staff discount"),
      allowQrCounterPay: bool(f, "allowQrCounterPay"),
      toyyibpaySandbox: bool(f, "toyyibpaySandbox"),
      toyyibpayCategory: str(f, "toyyibpayCategory").slice(0, 64) || null,
    };
    const secret = str(f, "toyyibpaySecret");
    if (secret) set.toyyibpaySecret = secret.slice(0, 128);
    if (bool(f, "clearToyyibpay")) {
      set.toyyibpaySecret = null;
      set.toyyibpayCategory = null;
    }

    const qr = f.get("duitnowQr");
    if (qr instanceof File && qr.size > 0) {
      if (qr.size > 400_000) return { error: "QR image is too big. Use a screenshot under 400 KB." };
      if (!/^image\/(png|jpeg|webp)$/.test(qr.type)) return { error: "QR image must be PNG, JPG or WebP." };
      set.duitnowQrUrl = `data:${qr.type};base64,${Buffer.from(await qr.arrayBuffer()).toString("base64")}`;
    }
    if (bool(f, "removeQr")) set.duitnowQrUrl = null;

    await db.update(tenants).set(set).where(eq(tenants.id, tenant.id));
    revalidatePath("/app", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------------------------------- Recon ---------------------------------- */

export async function closeDay(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { user, tenant } = await requireUser(["owner", "cashier"]);
  try {
    const date = str(f, "date");
    if (!isValidDate(date)) return { error: "Pick a valid date." };
    if (date > myDate()) return { error: "You can't close a future date." };
    const s = await reconSummary(tenant.id, date);
    if (s.openOrders > 0)
      return { error: `${s.openOrders} order(s) on ${date} are still unpaid or awaiting confirmation. Settle or cancel them first.` };
    const openingFloat = sen(f, "openingFloat", "opening float");
    await db.insert(reconciliations).values({
      id: uid(),
      tenantId: tenant.id,
      businessDate: date,
      openingFloat,
      expectedCash: s.byMethod.cash + s.settlements.cash,
      countedCash: sen(f, "countedCash", "cash counted"),
      expectedQr: s.byMethod.duitnow_qr + s.settlements.duitnow_qr,
      bankQr: sen(f, "bankQr", "QR in bank"),
      expectedOnline: s.byMethod.online,
      gatewayOnline: sen(f, "gatewayOnline", "online in gateway"),
      creditSales: s.byMethod.credit,
      notes: str(f, "notes").slice(0, 500) || null,
      closedBy: user.id,
    });
    revalidatePath("/app/recon");
    return { ok: true, message: `${date} closed.` };
  } catch (e) {
    if (e instanceof Error && /Duplicate entry/i.test(e.message)) return { error: "This date is already closed." };
    return fail(e);
  }
}

export async function reopenDay(date: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  await db
    .delete(reconciliations)
    .where(and(eq(reconciliations.tenantId, tenant.id), eq(reconciliations.businessDate, date)));
  revalidatePath("/app/recon");
  return { ok: true };
}

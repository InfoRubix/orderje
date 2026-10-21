"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { col, fs, isAlreadyExists, read } from "@/db";
import {
  DEFAULT_BRAND_COLOR,
  type Customer,
  type CustomerType,
  type DiningTable,
  type MenuItem,
  type ModifierGroup,
  type Order,
  type OrderStatus,
  type Payment,
  type Reconciliation,
  type Tenant,
  type User,
} from "@/db/schema";
import { requireUser } from "@/lib/auth";
import {
  createOrder,
  getOrderRow,
  OrderError,
  outstandingCredit,
  payAtCounter,
  setOrderCustomer,
} from "@/lib/orders";
import { getCustomer, getUserByEmail, isDayClosed, listCategories, listTables } from "@/lib/repo";
import { deleteImage, deleteImages, putImage } from "@/lib/storage";
import { reconSummary } from "@/lib/reports";
import { seedTables } from "@/lib/seed-menu";
import { toSen } from "@/lib/money";
import { isValidDate, myDate } from "@/lib/time";
import { token, uid } from "@/lib/utils";

export type ActionResult = { ok?: boolean; error?: string; message?: string; id?: string } | undefined;

async function assertOpenToday(tenantId: string) {
  if (await isDayClosed(tenantId, myDate())) throw new OrderError("Today is already closed in Recon. Ask the owner to reopen it before taking more payments.");
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
  const o = await getOrderRow(tenant.id, orderId);
  if (!o) return { error: "Order not found." };
  if (!NEXT[o.status].includes(status)) return { error: `Can't move a ${o.status} order to ${status}.` };
  if (status === "cancelled") {
    if (user.role === "kitchen") return { error: "Only the counter can cancel orders." };
    if (o.paymentStatus === "paid" || o.paymentStatus === "credit")
      return { error: "This order is paid. Refund it at the counter first." };
  }
  const orderRef = col.of(tenant.id, "orders").doc(o.id);
  try {
    await fs().runTransaction(async (tx) => {
      const fresh = read<Order>(await tx.get(orderRef));
      if (!fresh || fresh.status !== o.status) throw new OrderError("Someone else just updated this order. Refresh and try again.");
      if (status === "cancelled" && (fresh.paymentStatus === "paid" || fresh.paymentStatus === "credit"))
        throw new OrderError("This order is paid. Refund it at the counter first.");
      tx.update(orderRef, { status });
    });
  } catch (e) {
    return fail(e);
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

/** Reverses a paid order (refund handed back at the counter) so it can be cancelled or re-paid. */
export async function voidPayment(orderId: string, reason: string): Promise<ActionResult> {
  const { user, tenant } = await requireUser(["owner"]);
  if (!reason.trim()) return { error: "Give a reason for the void." };
  const o = await getOrderRow(tenant.id, orderId);
  if (!o || (o.paymentStatus !== "paid" && o.paymentStatus !== "credit")) return { error: "Nothing to void." };
  const date = myDate(o.paidAt ?? o.createdAt);
  if (await isDayClosed(tenant.id, date)) return { error: `${date} is already closed in Recon. Reopen that day first.` };
  const orderRef = col.of(tenant.id, "orders").doc(o.id);
  try {
    await fs().runTransaction(async (tx) => {
      const fresh = read<Order>(await tx.get(orderRef));
      if (!fresh || (fresh.paymentStatus !== "paid" && fresh.paymentStatus !== "credit")) throw new OrderError("Nothing to void.");
      const paid = await tx.get(col.of(tenant.id, "payments").where("orderId", "==", o.id).where("status", "==", "success"));
      for (const d of paid.docs)
        tx.update(d.ref, { status: "failed", reference: `VOID by ${user.name}: ${reason.trim()}`.slice(0, 120) });
      tx.update(orderRef, { paymentStatus: "unpaid", paidMethod: null, paidAt: null, total: fresh.total - fresh.rounding, rounding: 0 });
    });
  } catch (e) {
    return fail(e);
  }
  revalidatePath(`/app/orders/${orderId}`);
  return { ok: true };
}

/* ---------------------------------- Menu ---------------------------------- */

export async function addCategory(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const name = str(f, "name").slice(0, 40);
  if (!name) return { error: "Enter a category name." };
  const cats = col.of(tenant.id, "categories");
  const existing = await listCategories(tenant.id);
  await cats.doc(uid()).create({ tenantId: tenant.id, name, sort: (existing.at(-1)?.sort ?? -1) + 1 });
  revalidatePath("/app/menu");
  return { ok: true };
}

export async function renameCategory(id: string, name: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const clean = name.trim().slice(0, 40);
  if (!clean) return { error: "Enter a category name." };
  const ref = col.of(tenant.id, "categories").doc(id);
  if (!(await ref.get()).exists) return { error: "Category not found." };
  await ref.update({ name: clean });
  revalidatePath("/app/menu");
  return { ok: true };
}

/** Swaps a category with its neighbour and renumbers the rest, so the order is always 0..n-1. */
export async function moveCategory(id: string, dir: -1 | 1): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const cats = await listCategories(tenant.id);
  const i = cats.findIndex((c) => c.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= cats.length) return { ok: true };
  [cats[i], cats[j]] = [cats[j], cats[i]];
  const batch = fs().batch();
  cats.forEach((c, n) => c.sort !== n && batch.update(col.of(tenant.id, "categories").doc(c.id), { sort: n }));
  await batch.commit();
  revalidatePath("/app/menu");
  return { ok: true };
}

/** Deletes a category together with its items (the editor asks first). Past orders keep their own copy. */
export async function deleteCategory(id: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const items = await col.of(tenant.id, "menuItems").where("categoryId", "==", id).get();
  const batch = fs().batch();
  items.docs.forEach((d) => batch.delete(d.ref));
  batch.delete(col.of(tenant.id, "categories").doc(id));
  await batch.commit();
  await deleteImages(items.docs.map((d) => d.get("imagePath") as string | null));
  revalidatePath("/app/menu");
  return { ok: true };
}

const itemSchema = z.object({
  id: z.string().max(36).optional(),
  name: z.string().trim().min(1, "Give the item a name.").max(120),
  price: z.string(),
  categoryId: z.string().min(1, "Pick a category.").max(36),
  description: z.string().max(255).optional(),
  available: z.boolean(),
  groups: z
    .array(
      z.object({
        name: z.string().trim().min(1, "Every add-on group needs a name.").max(80),
        required: z.boolean(),
        maxSelect: z.number().int().min(1).max(20),
        options: z
          .array(z.object({ name: z.string().trim().min(1, "Every option needs a name.").max(80), price: z.string() }))
          .min(1, "Each add-on group needs at least one option.")
          .max(30),
      }),
    )
    .max(10),
});
export type ItemInput = z.infer<typeof itemSchema>;

/**
 * Creates or updates a menu item with its add-on groups in one go. The form sends the item as
 * JSON in "data", plus an optional "photo" file (already shrunk in the browser) or "removePhoto".
 */
export async function saveItem(f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  try {
    const d = itemSchema.parse(JSON.parse(String(f.get("data") ?? "{}")));
    const price = toSen(d.price);
    if (!Number.isFinite(price) || price <= 0) return { error: "Enter a price, e.g. 8.50." };
    if (!(await col.of(tenant.id, "categories").doc(d.categoryId).get()).exists) return { error: "Pick a category." };
    const items = col.of(tenant.id, "menuItems");
    const id = d.id || uid();
    const existing = d.id ? read<MenuItem>(await items.doc(d.id).get()) : undefined;
    if (d.id && !existing) return { error: "Item not found." };

    const groups: ModifierGroup[] = d.groups.map((g, gi) => {
      const groupId = uid();
      return {
        id: groupId,
        menuItemId: id,
        name: g.name,
        required: g.required,
        maxSelect: Math.min(g.maxSelect, g.options.length),
        sort: gi,
        options: g.options.map((o, oi) => {
          const p = o.price.trim() ? toSen(o.price) : 0;
          if (!Number.isFinite(p) || p < 0) throw new OrderError(`Check the extra price for ${o.name}.`);
          return { id: uid(), groupId, name: o.name, price: p, sort: oi };
        }),
      };
    });

    let image = { imageUrl: existing?.imageUrl ?? null, imagePath: existing?.imagePath ?? null };
    const photo = f.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const up = await putImage(tenant.id, "items", photo);
      image = { imageUrl: up.url, imagePath: up.path };
    } else if (f.get("removePhoto") === "1") image = { imageUrl: null, imagePath: null };

    const values = {
      name: d.name,
      price,
      categoryId: d.categoryId,
      description: d.description?.trim() || null,
      available: d.available,
      groups,
      ...image,
    };
    if (existing) {
      // Keep the item's place unless it moved to another category.
      const sort = existing.categoryId === d.categoryId ? existing.sort : Date.now();
      await items.doc(id).update({ ...values, sort });
      if (existing.imagePath && existing.imagePath !== image.imagePath) await deleteImage(existing.imagePath);
    } else {
      const item: Omit<MenuItem, "id"> = { tenantId: tenant.id, ...values, sort: Date.now() };
      await items.doc(id).create(item);
    }
    revalidatePath("/app/menu");
    return { ok: true, id, message: existing ? `${d.name} saved` : `${d.name} added to the menu` };
  } catch (e) {
    return fail(e);
  }
}

export async function toggleAvailable(id: string, available: boolean): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner", "cashier"]);
  const ref = col.of(tenant.id, "menuItems").doc(id);
  if (!(await ref.get()).exists) return { error: "Item not found." };
  await ref.update({ available });
  revalidatePath("/app/menu");
  return { ok: true };
}

export async function deleteMenuItem(id: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const ref = col.of(tenant.id, "menuItems").doc(id);
  const item = read<MenuItem>(await ref.get());
  if (!item) return { error: "Item not found." };
  await ref.delete();
  await deleteImage(item.imagePath);
  revalidatePath("/app/menu");
  return { ok: true, message: `${item.name} deleted` };
}

/* --------------------------------- Tables --------------------------------- */

export async function addTables(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const count = Math.min(100, Math.max(1, Number(str(f, "count") || 1)));
  const prefix = str(f, "prefix") || "Meja";
  const existing = await listTables(tenant.id);
  await seedTables(tenant.id, count, existing.length + 1, prefix);
  revalidatePath("/app/tables");
  return { ok: true };
}

export async function updateTable(id: string, patch: { label?: string; active?: boolean; regenerate?: boolean }): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  const set: Partial<DiningTable> = {};
  if (patch.label !== undefined) {
    if (!patch.label.trim()) return { error: "Table name can't be empty." };
    set.label = patch.label.trim().slice(0, 40);
  }
  if (patch.active !== undefined) set.active = patch.active;
  if (patch.regenerate) set.token = token(12);
  const ref = col.of(tenant.id, "tables").doc(id);
  if (!(await ref.get()).exists) return { error: "Table not found." };
  await ref.update(set);
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
    const list = col.of(tenant.id, "customers");
    if (id) {
      if (!(await list.doc(id).get()).exists) return { error: "Customer not found." };
      await list.doc(id).update(values);
    } else {
      const c: Omit<Customer, "id"> = { tenantId: tenant.id, ...values, createdAt: new Date() };
      await list.doc(uid()).create(c);
    }
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
    const method = str(f, "method") as "cash" | "duitnow_qr";
    if (!["cash", "duitnow_qr"].includes(method)) return { error: "Pick how they paid." };
    const amount = sen(f, "amount", "amount", false);
    const c = customerId ? await getCustomer(tenant.id, customerId) : undefined;
    if (!c || c.type !== "corporate") return { error: "Corporate customer not found." };
    const owing = await outstandingCredit(tenant.id, c.id);
    if (amount > owing) return { error: `They only owe ${(owing / 100).toFixed(2)}.` };
    const now = new Date();
    const pay: Omit<Payment, "id"> = {
      tenantId: tenant.id,
      orderId: null,
      customerId: c.id,
      kind: "settlement",
      method,
      status: "success",
      amount,
      tendered: null,
      changeGiven: null,
      reference: str(f, "reference").slice(0, 120) || null,
      receivedBy: user.id,
      createdAt: now,
      confirmedAt: now,
    };
    await col.of(tenant.id, "payments").doc(uid()).create(pay);
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
  const emailTaken = { error: "That email is already used by another account." };
  const clash = await getUserByEmail(email);
  if (clash && clash.id !== id) return emailTaken;

  try {
    if (id) {
      if (id === me.id && role !== "owner") return { error: "You can't remove your own owner role." };
      const set: Partial<User> = { name, email, role: role as "owner" };
      if (password) {
        if (password.length < 8) return { error: "Password needs at least 8 characters." };
        set.passwordHash = await bcrypt.hash(password, 10);
      }
      const ref = col.users().doc(id);
      await fs().runTransaction(async (tx) => {
        const cur = read<User>(await tx.get(ref));
        if (!cur || cur.tenantId !== tenant.id) throw new OrderError("Staff not found.");
        if (cur.email !== email) {
          tx.create(col.emails().doc(email), { userId: id });
          tx.delete(col.emails().doc(cur.email));
        }
        tx.update(ref, set);
      });
    } else {
      if (password.length < 8) return { error: "Set a password of at least 8 characters." };
      const newId = uid();
      const u: Omit<User, "id"> = {
        tenantId: tenant.id,
        name,
        email,
        role: role as "owner",
        passwordHash: await bcrypt.hash(password, 10),
        active: true,
        createdAt: new Date(),
      };
      const batch = fs().batch();
      batch.create(col.emails().doc(email), { userId: newId });
      batch.create(col.users().doc(newId), u);
      await batch.commit();
    }
  } catch (e) {
    if (isAlreadyExists(e)) return emailTaken;
    return fail(e);
  }
  revalidatePath("/app/staff");
  return { ok: true, message: id ? "Saved." : `${name} can now log in.` };
}

export async function setStaffActive(id: string, active: boolean): Promise<ActionResult> {
  const { user: me, tenant } = await requireUser(["owner"]);
  if (id === me.id) return { error: "You can't deactivate yourself." };
  const ref = col.users().doc(id);
  if ((await ref.get()).get("tenantId") !== tenant.id) return { error: "Staff not found." };
  await ref.update({ active });
  revalidatePath("/app/staff");
  return { ok: true };
}

/* -------------------------------- Settings -------------------------------- */

export async function saveSettings(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  try {
    const set: Partial<Tenant> = {
      email: str(f, "email").slice(0, 160) || null,
      sstRate: rate(f, "sstRate", "SST"),
      serviceChargeRate: rate(f, "serviceChargeRate", "Service charge"),
      memberDiscountRate: rate(f, "memberDiscountRate", "Member discount"),
      staffDiscountRate: rate(f, "staffDiscountRate", "Staff discount"),
    };
    await col.tenants().doc(tenant.id).update(set);
    revalidatePath("/app", "layout");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    return fail(e);
  }
}

/** Brand & profile: what customers see on the QR menu, order page and receipt. */
export async function saveBrand(_: ActionResult, f: FormData): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  try {
    const name = str(f, "name").slice(0, 60);
    if (!name) return { error: "Enter the kedai name." };
    const color = str(f, "brandColor").toLowerCase();
    const set: Partial<Tenant> = {
      name,
      tagline: str(f, "tagline").slice(0, 80) || null,
      address: str(f, "address").slice(0, 160) || null,
      phone: str(f, "phone").slice(0, 32) || null,
      receiptFooter: str(f, "receiptFooter").slice(0, 120) || null,
      brandColor: /^#[0-9a-f]{6}$/.test(color) ? color : DEFAULT_BRAND_COLOR,
    };
    const logo = f.get("logo");
    if (logo instanceof File && logo.size > 0) {
      const up = await putImage(tenant.id, "logo", logo);
      set.logoUrl = up.url;
      set.logoPath = up.path;
    } else if (bool(f, "removeLogo")) {
      set.logoUrl = null;
      set.logoPath = null;
    }
    await col.tenants().doc(tenant.id).update(set);
    if (set.logoPath !== undefined && tenant.logoPath && tenant.logoPath !== set.logoPath) await deleteImage(tenant.logoPath);
    revalidatePath("/app", "layout");
    return { ok: true, message: "Saved. Customers see it straight away." };
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
      return { error: `${s.openOrders} order(s) on ${date} are still unpaid. Settle or cancel them first.` };
    const openingFloat = sen(f, "openingFloat", "opening float");
    const rec: Omit<Reconciliation, "id"> = {
      tenantId: tenant.id,
      businessDate: date,
      openingFloat,
      expectedCash: s.byMethod.cash + s.settlements.cash,
      countedCash: sen(f, "countedCash", "cash counted"),
      expectedQr: s.byMethod.duitnow_qr + s.settlements.duitnow_qr,
      bankQr: sen(f, "bankQr", "QR in bank"),
      creditSales: s.byMethod.credit,
      notes: str(f, "notes").slice(0, 500) || null,
      closedBy: user.id,
      createdAt: new Date(),
    };
    await col.of(tenant.id, "reconciliations").doc(date).create(rec);
    revalidatePath("/app/recon");
    return { ok: true, message: `${date} closed.` };
  } catch (e) {
    if (isAlreadyExists(e)) return { error: "This date is already closed." };
    return fail(e);
  }
}

export async function reopenDay(date: string): Promise<ActionResult> {
  const { tenant } = await requireUser(["owner"]);
  if (!isValidDate(date)) return { error: "Pick a valid date." };
  await col.of(tenant.id, "reconciliations").doc(date).delete();
  revalidatePath("/app/recon");
  return { ok: true };
}

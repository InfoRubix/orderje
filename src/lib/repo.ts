import "server-only";
import { col, read, readAll } from "@/db";
import { DEFAULT_BRAND_COLOR } from "@/db/schema";
import { DEFAULT_LANG, isLang } from "@/lib/i18n";
import type {
  Category,
  Customer,
  DiningTable,
  Order,
  Payment,
  Reconciliation,
  RegisteredCustomerType,
  Tenant,
  User,
} from "@/db/schema";

/** Plain reads shared by pages and actions. Writes live next to the business rules that need them. */

const bySortThenName = <T extends { sort: number; name?: string; label?: string }>(a: T, b: T) =>
  a.sort - b.sort || String(a.name ?? a.label ?? "").localeCompare(String(b.name ?? b.label ?? ""));

export async function getTenant(id: string) {
  const t = read<Tenant>(await col.tenants().doc(id).get());
  // Kedai created before branding existed have no brand fields yet.
  return t && { ...t, tagline: t.tagline ?? null, logoUrl: t.logoUrl ?? null, logoPath: t.logoPath ?? null, brandColor: t.brandColor || DEFAULT_BRAND_COLOR, language: isLang(t.language) ? t.language : DEFAULT_LANG };
}

export async function getTenantBySlug(slug: string) {
  const s = await col.slugs().doc(slug).get();
  return s.exists ? getTenant(String(s.get("tenantId"))) : undefined;
}

export async function getUser(id: string) {
  return read<User>(await col.users().doc(id).get());
}

export async function getUserByEmail(email: string) {
  const s = await col.emails().doc(email.toLowerCase()).get();
  return s.exists ? getUser(String(s.get("userId"))) : undefined;
}

export async function listUsers(tenantId: string) {
  const list = readAll<User>(await col.users().where("tenantId", "==", tenantId).get());
  return list.sort((a, b) => a.name.localeCompare(b.name));
}

export async function listCategories(tenantId: string) {
  return readAll<Category>(await col.of(tenantId, "categories").get()).sort(bySortThenName);
}

export async function listTables(tenantId: string, opts: { activeOnly?: boolean } = {}) {
  const list = readAll<DiningTable>(await col.of(tenantId, "tables").get()).sort(bySortThenName);
  return opts.activeOnly ? list.filter((t) => t.active) : list;
}

export async function getTableByToken(tenantId: string, tokenValue: string) {
  const qs = await col.of(tenantId, "tables").where("token", "==", tokenValue).limit(1).get();
  return qs.empty ? undefined : read<DiningTable>(qs.docs[0]);
}

export async function getTable(tenantId: string, id: string) {
  return read<DiningTable>(await col.of(tenantId, "tables").doc(id).get());
}

export async function listCustomers(tenantId: string, opts: { type?: RegisteredCustomerType; activeOnly?: boolean } = {}) {
  const q = opts.type ? col.of(tenantId, "customers").where("type", "==", opts.type) : col.of(tenantId, "customers");
  const list = readAll<Customer>(await q.get()).sort((a, b) => a.name.localeCompare(b.name));
  return opts.activeOnly ? list.filter((c) => c.active) : list;
}

export async function getCustomer(tenantId: string, id: string) {
  return read<Customer>(await col.of(tenantId, "customers").doc(id).get());
}

/** Orders created in [start, end), newest first. */
export async function ordersCreatedBetween(tenantId: string, start: Date, end?: Date) {
  let q = col.of(tenantId, "orders").where("createdAt", ">=", start);
  if (end) q = q.where("createdAt", "<", end);
  return readAll<Order>(await q.orderBy("createdAt", "desc").get());
}

/** Orders settled (paid or put on credit) in [start, end). */
export async function ordersPaidBetween(tenantId: string, start: Date, end?: Date) {
  let q = col.of(tenantId, "orders").where("paidAt", ">=", start);
  if (end) q = q.where("paidAt", "<", end);
  const list = readAll<Order>(await q.orderBy("paidAt", "desc").get());
  return list.filter((o) => o.paymentStatus === "paid" || o.paymentStatus === "credit");
}

/** Successful payments confirmed in [start, end), oldest first. */
export async function paymentsConfirmedBetween(tenantId: string, start: Date, end: Date) {
  const qs = await col
    .of(tenantId, "payments")
    .where("confirmedAt", ">=", start)
    .where("confirmedAt", "<", end)
    .orderBy("confirmedAt", "asc")
    .get();
  return readAll<Payment>(qs).filter((p) => p.status === "success");
}

export async function getReconciliation(tenantId: string, date: string) {
  return read<Reconciliation>(await col.of(tenantId, "reconciliations").doc(date).get());
}

export async function isDayClosed(tenantId: string, date: string) {
  return (await col.of(tenantId, "reconciliations").doc(date).get()).exists;
}

export async function recentReconciliations(tenantId: string, n: number) {
  const qs = await col.of(tenantId, "reconciliations").orderBy("businessDate", "desc").limit(n).get();
  return readAll<Reconciliation>(qs);
}

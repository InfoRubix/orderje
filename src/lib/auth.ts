import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { tenants, users, type Role } from "@/db/schema";
import { SESSION_COOKIE, verifySession } from "./session";

export async function getSession() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Loads the signed-in user + tenant, re-checking the DB so deactivated staff lose access immediately. */
export async function requireUser(roles?: Role[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  const [row] = await db
    .select({ user: users, tenant: tenants })
    .from(users)
    .innerJoin(tenants, eq(tenants.id, users.tenantId))
    .where(eq(users.id, s.uid))
    .limit(1);
  if (!row || !row.user.active) redirect("/login?e=inactive");
  if (!row.tenant.active) redirect("/login?e=suspended");
  if (roles && !roles.includes(row.user.role)) redirect(homeFor(row.user.role));
  return row;
}

export function homeFor(role: Role) {
  if (role === "kitchen") return "/app/kitchen";
  if (role === "cashier") return "/app/pos";
  return "/app";
}

export function isSuperAdmin(email: string) {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Role } from "@/db/schema";
import { getTenant, getUser } from "./repo";
import { SESSION_COOKIE, verifySession } from "./session";

export async function getSession() {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Loads the signed-in user + tenant, re-checking the DB so deactivated staff lose access immediately. */
export async function requireUser(roles?: Role[]) {
  const s = await getSession();
  if (!s) redirect("/login");
  const user = await getUser(s.uid);
  if (!user || !user.active) redirect("/login?e=inactive");
  const tenant = await getTenant(user.tenantId);
  if (!tenant || !tenant.active) redirect("/login?e=suspended");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return { user, tenant };
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

"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { tenants, users } from "@/db/schema";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { homeFor } from "@/lib/auth";
import { seedSampleMenu, seedTables } from "@/lib/seed-menu";
import { slugify, uid } from "@/lib/utils";

export type AuthState = { error?: string } | undefined;

async function startSession(u: typeof users.$inferSelect) {
  const jwt = await signSession({ uid: u.id, tid: u.tenantId, role: u.role, name: u.name, email: u.email });
  (await cookies()).set(SESSION_COOKIE, jwt, sessionCookieOptions);
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [u] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return { error: "Email or password is incorrect." };
  if (!u.active) return { error: "This account has been deactivated. Ask the owner to reactivate it." };
  const [t] = await db.select().from(tenants).where(eq(tenants.id, u.tenantId)).limit(1);
  if (!t?.active) return { error: "This kedai's subscription is suspended. Contact Rubix support." };
  await startSession(u);
  redirect(homeFor(u.role));
}

const signupSchema = z.object({
  shopName: z.string().trim().min(2, "Enter the kedai name"),
  slug: z
    .string()
    .trim()
    .min(3, "Link name needs at least 3 characters")
    .max(48)
    .regex(/^[a-z0-9-]+$/, "Use lowercase letters, numbers and dashes only"),
  ownerName: z.string().trim().min(2, "Enter your name"),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(8, "Password needs at least 8 characters"),
  tables: z.coerce.number().int().min(0).max(200),
  sample: z.string().optional(),
});

export async function signup(_: AuthState, form: FormData): Promise<AuthState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "Sign-up is closed. Contact Rubix to get onboarded." };
  const raw = Object.fromEntries(form);
  const parsed = signupSchema.safeParse({ ...raw, slug: slugify(String(raw.slug || raw.shopName || "")) });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const [slugTaken] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.slug, d.slug)).limit(1);
  if (slugTaken) return { error: `The link name "${d.slug}" is taken. Try another.` };
  const [emailTaken] = await db.select({ id: users.id }).from(users).where(eq(users.email, d.email)).limit(1);
  if (emailTaken) return { error: "An account with this email already exists. Log in instead." };

  const tenantId = uid();
  const userId = uid();
  await db.insert(tenants).values({ id: tenantId, slug: d.slug, name: d.shopName, email: d.email });
  await db.insert(users).values({
    id: userId,
    tenantId,
    name: d.ownerName,
    email: d.email,
    passwordHash: await bcrypt.hash(d.password, 10),
    role: "owner",
  });
  await seedTables(tenantId, d.tables);
  if (d.sample) await seedSampleMenu(tenantId);

  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  await startSession(u);
  redirect("/app");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

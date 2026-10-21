"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { col, fs, isAlreadyExists } from "@/db";
import { DEFAULT_BRAND_COLOR, type Tenant, type User } from "@/db/schema";
import { getTenant, getUserByEmail } from "@/lib/repo";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";
import { homeFor } from "@/lib/auth";
import { seedSampleMenu, seedTables } from "@/lib/seed-menu";
import { slugify, uid } from "@/lib/utils";

export type AuthState = { error?: string } | undefined;

async function startSession(u: Pick<User, "id" | "tenantId" | "role" | "name" | "email">) {
  const jwt = await signSession({ uid: u.id, tid: u.tenantId, role: u.role, name: u.name, email: u.email });
  (await cookies()).set(SESSION_COOKIE, jwt, sessionCookieOptions);
}

export async function login(_: AuthState, form: FormData): Promise<AuthState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const u = email ? await getUserByEmail(email) : undefined;
  if (!u || !(await bcrypt.compare(password, u.passwordHash))) return { error: "Email or password is incorrect." };
  if (!u.active) return { error: "This account has been deactivated. Ask the owner to reactivate it." };
  const t = await getTenant(u.tenantId);
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

  const slugTaken = { error: `The link name "${d.slug}" is taken. Try another.` };
  const emailTaken = { error: "An account with this email already exists. Log in instead." };
  if ((await col.slugs().doc(d.slug).get()).exists) return slugTaken;
  if (await getUserByEmail(d.email)) return emailTaken;

  const tenantId = uid();
  const userId = uid();
  const now = new Date();
  const tenant: Omit<Tenant, "id"> = {
    slug: d.slug,
    name: d.shopName,
    tagline: null,
    address: null,
    phone: null,
    email: d.email,
    logoUrl: null,
    logoPath: null,
    brandColor: DEFAULT_BRAND_COLOR,
    sstRate: 0,
    serviceChargeRate: 0,
    memberDiscountRate: 500,
    staffDiscountRate: 2000,
    receiptFooter: null,
    orderSeq: 0,
    active: true,
    createdAt: now,
  };
  const user: Omit<User, "id"> = {
    tenantId,
    name: d.ownerName,
    email: d.email,
    passwordHash: await bcrypt.hash(d.password, 10),
    role: "owner",
    active: true,
    createdAt: now,
  };
  // The slug and email docs make the whole signup fail if either was claimed a moment ago.
  try {
    await fs().runTransaction(async (tx) => {
      const [slug, email] = await Promise.all([tx.get(col.slugs().doc(d.slug)), tx.get(col.emails().doc(d.email))]);
      if (slug.exists) throw Object.assign(new Error("slug"), { taken: slugTaken });
      if (email.exists) throw Object.assign(new Error("email"), { taken: emailTaken });
      tx.create(col.slugs().doc(d.slug), { tenantId });
      tx.create(col.emails().doc(d.email), { userId });
      tx.create(col.tenants().doc(tenantId), tenant);
      tx.create(col.users().doc(userId), user);
    });
  } catch (e) {
    const taken = (e as { taken?: AuthState }).taken;
    if (taken) return taken;
    if (isAlreadyExists(e)) return emailTaken;
    throw e;
  }
  await seedTables(tenantId, d.tables);
  if (d.sample) await seedSampleMenu(tenantId);

  await startSession({ id: userId, ...user });
  redirect("/app");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

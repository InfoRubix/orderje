import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/db/schema";

/** Edge-safe session helpers (used by middleware and server code). */
export const SESSION_COOKIE = "oj_session";
const MAX_AGE = 60 * 60 * 24 * 14;

export type SessionPayload = {
  uid: string;
  tid: string;
  role: Role;
  name: string;
  email: string;
};

function key() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set (32+ chars)");
  return new TextEncoder().encode(s);
}

export async function signSession(p: SessionPayload) {
  return new SignJWT(p)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(key());
}

export async function verifySession(tokenValue: string | undefined): Promise<SessionPayload | null> {
  if (!tokenValue) return null;
  try {
    const { payload } = await jwtVerify(tokenValue, key());
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: MAX_AGE,
};

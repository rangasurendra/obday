import { SignJWT, jwtVerify } from "jose";
import type { Role } from "./users";

export const SESSION_COOKIE = "obday_session";
const MAX_AGE_SECONDS = 18 * 60 * 60;

export type Session = { username: string; role: Role };

function secret(): Uint8Array {
  const value = process.env.SESSION_SECRET;
  if (!value) {
    if (process.env.VERCEL) throw new Error("SESSION_SECRET is not set");
    return new TextEncoder().encode("obday-local-dev-secret-not-for-production");
  }
  return new TextEncoder().encode(value);
}

export async function createSessionToken(session: Session): Promise<string> {
  return new SignJWT({ role: session.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(session.username)
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { username: payload.sub, role: payload.role === "admin" ? "admin" : "staff" };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

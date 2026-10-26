import { eq, and, gt } from "drizzle-orm";
import { profiles, sessions } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/orders/common";

export const SESSION_COOKIE_NAME = "spn_session";
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

/**
 * Generate a cryptographically secure random session token.
 * 32 bytes = 256 bits of entropy.
 */
export function generateSessionToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let token = "";
  for (let i = 0; i < bytes.length; i++) {
    token += bytes[i].toString(16).padStart(2, "0");
  }
  return token;
}

/**
 * Hash session token using SHA-256 for secure database storage.
 * The plaintext token lives only in the user's HttpOnly cookie.
 */
export async function hashSessionToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hashBuffer);
  let hashHex = "";
  for (let i = 0; i < bytes.length; i++) {
    hashHex += bytes[i].toString(16).padStart(2, "0");
  }
  return hashHex;
}

export type ValidatedSession = {
  sessionId: string;
  profile: {
    id: string;
    email: string;
    name: string | null;
    phone: string | null;
    role: "customer" | "admin";
  };
};

/**
 * Create a new database-backed session for a profile.
 */
export async function createSession(
  db: AnyDb,
  profileId: string
): Promise<{ sessionToken: string; expiresAt: Date }> {
  const sessionToken = generateSessionToken();
  const tokenHash = await hashSessionToken(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  await db.insert(sessions).values({
    profileId,
    tokenHash,
    expiresAt,
  });

  return { sessionToken, expiresAt };
}

/**
 * Validate a session token against the database.
 * Returns the authenticated profile and session ID, or null if invalid or expired.
 */
export async function validateSession(
  db: AnyDb,
  sessionToken: string
): Promise<ValidatedSession | null> {
  if (!sessionToken || typeof sessionToken !== "string") {
    return null;
  }

  const tokenHash = await hashSessionToken(sessionToken);
  const now = new Date();

  const [row] = await db
    .select({
      sessionId: sessions.id,
      expiresAt: sessions.expiresAt,
      profileId: profiles.id,
      email: profiles.email,
      name: profiles.name,
      phone: profiles.phone,
      role: profiles.role,
      deletedAt: profiles.deletedAt,
    })
    .from(sessions)
    .innerJoin(profiles, eq(sessions.profileId, profiles.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, now)));

  if (!row) {
    return null;
  }

  // If the profile has been soft-deleted, invalidate and refuse
  if (row.deletedAt) {
    await db.delete(sessions).where(eq(sessions.id, row.sessionId));
    return null;
  }

  return {
    sessionId: row.sessionId,
    profile: {
      id: row.profileId,
      email: row.email,
      name: row.name,
      phone: row.phone,
      role: row.role as "customer" | "admin",
    },
  };
}

/**
 * Invalidate a single session token (logout).
 */
export async function invalidateSession(db: AnyDb, sessionToken: string): Promise<void> {
  if (!sessionToken) return;
  const tokenHash = await hashSessionToken(sessionToken);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
}

/**
 * Invalidate all sessions for a user (e.g. on password reset or account security event).
 */
export async function invalidateAllUserSessions(db: AnyDb, profileId: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.profileId, profileId));
}

/**
 * Extract session token from request Cookie header.
 */
export function extractSessionTokenFromRequest(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${SESSION_COOKIE_NAME}=`)) {
      return decodeURIComponent(cookie.substring(SESSION_COOKIE_NAME.length + 1));
    }
  }
  return null;
}

/**
 * Build the Set-Cookie string for a new session.
 */
export function serializeSessionCookie(token: string, expiresAt: Date): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}; Max-Age=${SESSION_MAX_AGE_SECONDS}${secureFlag}`;
}

/**
 * Build the Set-Cookie string to clear the session cookie on logout.
 */
export function serializeClearSessionCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

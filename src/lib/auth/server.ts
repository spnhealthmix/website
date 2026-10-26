import { cookies } from "next/headers";
import { getTxDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, validateSession } from "./session";

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  role: "customer" | "admin";
};

/**
 * Server-side helper to retrieve the authenticated user from the session cookie.
 * Safe to call from Next.js Server Components, Server Actions, and Route Handlers.
 */
export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return null;

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) return null;

    const { db, close } = getTxDb(databaseUrl);
    try {
      const validated = await validateSession(db, sessionCookie.value);
      if (!validated) return null;
      return validated.profile;
    } finally {
      await close();
    }
  } catch (err) {
    console.error("getCurrentUser error:", err);
    return null;
  }
}

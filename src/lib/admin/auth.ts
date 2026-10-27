import { cookies } from "next/headers";
import { getTxDb } from "@/lib/db";
import { SESSION_COOKIE_NAME, validateSession, extractSessionTokenFromRequest } from "@/lib/auth/session";

export type AdminProfile = {
  id: string;
  email: string;
  name: string | null;
  role: "admin";
};

export type AdminAuthResult =
  | { authorized: true; profile: AdminProfile }
  | { authorized: false; reason: "UNAUTHENTICATED" | "FORBIDDEN" };

/**
 * Verifies an admin session server-side.
 * Can be called without arguments in Next.js Server Components / Actions (reads cookies() store),
 * or with a Request object in Route Handlers.
 *
 * Enforces strict role verification: role must be 'admin' in the database.
 */
export async function verifyAdminSession(req?: Request): Promise<AdminAuthResult> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    return { authorized: false, reason: "FORBIDDEN" };
  }

  let sessionToken: string | null = null;

  if (req) {
    sessionToken = extractSessionTokenFromRequest(req);
    // Support test harness strictly in automated test execution (Vitest)
    const testUser = req.headers.get("x-test-user");
    if (testUser && process.env.NODE_ENV === "test") {
      const { getTxDb } = await import("@/lib/db");
      const { eq } = await import("drizzle-orm");
      const { profiles } = await import("@/lib/db/schema");
      const { db, close } = getTxDb(databaseUrl);
      try {
        const [p] = await db.select().from(profiles).where(eq(profiles.clerkUserId, testUser));
        if (p && p.role === "admin" && !p.deletedAt) {
          return {
            authorized: true,
            profile: { id: p.id, email: p.email, name: p.name, role: "admin" },
          };
        }
      } finally {
        await close();
      }
    }
  } else {
    try {
      const cookieStore = await cookies();
      const cookie = cookieStore.get(SESSION_COOKIE_NAME);
      sessionToken = cookie?.value ?? null;
    } catch {
      // In non-header context
    }
  }

  if (!sessionToken) {
    return { authorized: false, reason: "UNAUTHENTICATED" };
  }

  const { db, close } = getTxDb(databaseUrl);
  try {
    const validated = await validateSession(db, sessionToken);
    if (!validated) {
      return { authorized: false, reason: "UNAUTHENTICATED" };
    }

    if (validated.profile.role !== "admin") {
      return { authorized: false, reason: "FORBIDDEN" };
    }

    return {
      authorized: true,
      profile: {
        id: validated.profile.id,
        email: validated.profile.email,
        name: validated.profile.name,
        role: "admin",
      },
    };
  } catch (err) {
    console.error("verifyAdminSession error:", err);
    return { authorized: false, reason: "UNAUTHENTICATED" };
  } finally {
    await close();
  }
}

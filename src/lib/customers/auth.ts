import type { AnyDb } from "../orders/common";
import type { AuthedUser } from "./profile";
import { extractSessionTokenFromRequest, validateSession } from "@/lib/auth/session";

/**
 * Resolves the authenticated user from the request's secure session cookie.
 * In dev/test environments, supports the x-test-user header.
 * Never trusts client-provided profileId in bodies or query strings.
 */
export async function customerAuthenticate(req: Request, db: AnyDb): Promise<AuthedUser | null> {
  // Support test harness in non-production
  const testUser = req.headers.get("x-test-user");
  if (testUser && process.env.NODE_ENV !== "production") {
    const { ensureProfile } = await import("./profile");
    return ensureProfile(db, testUser, async () => ({
      email: `${testUser}@example.com`,
      name: testUser,
    }));
  }

  const token = extractSessionTokenFromRequest(req);
  if (!token) return null;

  const validated = await validateSession(db, token);
  if (!validated) return null;

  return {
    profileId: validated.profile.id,
    role: validated.profile.role,
  };
}

// Backward-compatibility alias
export const clerkAuthenticate = customerAuthenticate;

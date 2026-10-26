import { eq } from "drizzle-orm";
import { addresses, profiles } from "../db/schema";
import { normalizeEmail, profileEmailMatches } from "../auth/email";
import type { AnyDb } from "../orders/common";
import { CustomerError } from "./errors";

export type UserInfo = { email: string; name: string | null; phone?: string | null };
export type AuthedUser = { profileId: string; clerkUserId?: string; role?: string };

/**
 * Retrieve a profile by ID. Throws CustomerError if not found.
 */
export async function getProfile(db: AnyDb, profileId: string) {
  const [p] = await db
    .select({
      id: profiles.id,
      email: profiles.email,
      name: profiles.name,
      phone: profiles.phone,
      role: profiles.role,
      createdAt: profiles.createdAt,
    })
    .from(profiles)
    .where(eq(profiles.id, profileId));

  if (!p) throw new CustomerError("PROFILE_NOT_FOUND", "Profile not found.");
  return p;
}

/**
 * Update editable profile fields (name and phone).
 */
export async function updateProfile(
  db: AnyDb,
  profileId: string,
  patch: { name?: string; phone?: string | null }
) {
  await db.update(profiles).set(patch).where(eq(profiles.id, profileId));
  return getProfile(db, profileId);
}

/**
 * Soft-delete a profile. Orders keep pointing at the profile row to preserve accounting records,
 * but personal information is cleared and sessions are revoked.
 */
export async function markProfileDeleted(db: AnyDb, profileIdOrClerkId: string) {
  await db.transaction(async (tx) => {
    // Check if matching by UUID or clerkUserId
    const [p] = await tx
      .select()
      .from(profiles)
      .where(eq(profiles.id, profileIdOrClerkId))
      .for("update");

    const target = p ?? (
      await tx
        .select()
        .from(profiles)
        .where(eq(profiles.clerkUserId, profileIdOrClerkId))
        .for("update")
    )[0];

    if (!target || target.deletedAt) return;
    await tx.delete(addresses).where(eq(addresses.profileId, target.id));
    await tx
      .update(profiles)
      .set({
        deletedAt: new Date(),
        name: null,
        phone: null,
        passwordHash: null,
        email: `deleted-${target.id}@invalid.local`,
      })
      .where(eq(profiles.id, target.id));
  });
}

/**
 * Lookup or create a profile by user identifier (used in dev/test or internal provisioning).
 */
export async function ensureProfile(
  db: AnyDb,
  userIdentifier: string,
  fetchUser: () => Promise<UserInfo>
): Promise<AuthedUser | null> {
  // Check by clerkUserId (legacy) or email
  const [existing] = await db
    .select({ id: profiles.id, role: profiles.role, deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(eq(profiles.clerkUserId, userIdentifier));

  if (existing) {
    return existing.deletedAt ? null : { profileId: existing.id, role: existing.role };
  }

  const info = await fetchUser();
  const normalizedEmail = normalizeEmail(info.email);

  const matchingProfiles = await db
    .select({ id: profiles.id, role: profiles.role, deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(profileEmailMatches(normalizedEmail))
    .limit(2);
  if (matchingProfiles.length > 1) return null;
  const byEmail = matchingProfiles[0];

  if (byEmail) {
    return byEmail.deletedAt ? null : { profileId: byEmail.id, role: byEmail.role };
  }

  const [row] = await db
    .insert(profiles)
    .values({
      clerkUserId: userIdentifier,
      email: normalizedEmail,
      name: info.name,
      phone: info.phone ?? null,
    })
    .returning({ id: profiles.id, role: profiles.role });

  return row ? { profileId: row.id, role: row.role } : null;
}

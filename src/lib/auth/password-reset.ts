import { eq, and, gt, isNull } from "drizzle-orm";
import { passwordResetTokens, profiles, sessions } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/orders/common";
import { normalizeEmail, profileEmailMatches } from "./email";
import { hashSessionToken } from "./session";
import { hashPassword, validatePasswordPolicy } from "./password";

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateResetToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let token = "";
  for (let i = 0; i < bytes.length; i++) {
    token += bytes[i].toString(16).padStart(2, "0");
  }
  return token;
}

export async function createPasswordResetToken(
  db: AnyDb,
  email: string
): Promise<{ resetToken: string; email: string; name: string | null } | null> {
  const matchingProfiles = await db
    .select({ id: profiles.id, email: profiles.email, name: profiles.name, deletedAt: profiles.deletedAt })
    .from(profiles)
    .where(profileEmailMatches(normalizeEmail(email)))
    .limit(2);
  const profile = matchingProfiles.length === 1 ? matchingProfiles[0] : null;

  if (!profile || profile.deletedAt) {
    return null;
  }

  const resetToken = generateResetToken();
  const tokenHash = await hashSessionToken(resetToken);
  const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  // Invalidate any existing unused reset tokens for this user
  await db
    .delete(passwordResetTokens)
    .where(eq(passwordResetTokens.profileId, profile.id));

  await db.insert(passwordResetTokens).values({
    profileId: profile.id,
    tokenHash,
    expiresAt,
  });

  return { resetToken, email: profile.email, name: profile.name };
}

export async function verifyAndConsumePasswordResetToken(
  db: AnyDb,
  token: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const policy = validatePasswordPolicy(newPassword);
  if (!policy.valid) {
    return { success: false, error: policy.error };
  }

  const tokenHash = await hashSessionToken(token);
  const now = new Date();

  const [record] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now)
      )
    );

  if (!record) {
    return { success: false, error: "Invalid or expired password reset link." };
  }

  const newHash = await hashPassword(newPassword);

  // Update password, mark token used, and invalidate any existing sessions
  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({ passwordHash: newHash, updatedAt: new Date() })
      .where(eq(profiles.id, record.profileId));

    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, record.id));

    await tx.delete(sessions).where(eq(sessions.profileId, record.profileId));
  });

  return { success: true };
}

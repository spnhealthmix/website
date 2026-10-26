/**
 * SPN Foods — Admin Provisioning CLI
 *
 * Securely creates or promotes an administrative account directly in the database.
 * Run with:
 *   npx tsx --env-file=.env scripts/create-admin.ts <email> <password> [name] [phone]
 *
 * Example:
 *   npx tsx --env-file=.env scripts/create-admin.ts admin@spnfoods.com "SecurePass123" "Admin Name" "9876543210"
 */

import { eq } from "drizzle-orm";
import { getTxDb } from "../src/lib/db/index";
import { profiles } from "../src/lib/db/schema";
import { normalizeEmail, profileEmailMatches } from "../src/lib/auth/email";
import { hashPassword, validatePasswordPolicy } from "../src/lib/auth/password";

async function main() {
  const args = process.argv.slice(2);
  const email = args[0];
  const password = args[1];
  const name = args[2] || "SPN Store Admin";
  const phone = args[3] || null;

  if (!email || !password) {
    console.error("\n❌ Usage: npx tsx --env-file=.env scripts/create-admin.ts <email> <password> [name] [phone]\n");
    process.exit(1);
  }

  const normalizedEmail = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    console.error("\n❌ Error: Invalid email format.\n");
    process.exit(1);
  }

  const policy = validatePasswordPolicy(password);
  if (!policy.valid) {
    console.error(`\n❌ Error: ${policy.error}\n`);
    process.exit(1);
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("\n❌ Error: DATABASE_URL environment variable is not defined.\n");
    process.exit(1);
  }

  console.log(`\n⏳ Provisioning admin user: ${normalizedEmail}...`);
  const { db, close } = getTxDb(databaseUrl);

  try {
    const passwordHash = await hashPassword(password);

    const matchingProfiles = await db
      .select()
      .from(profiles)
      .where(profileEmailMatches(normalizedEmail))
      .limit(2);

    if (matchingProfiles.length > 1) {
      throw new Error("Multiple profiles match this email; resolve the ambiguity before provisioning.");
    }
    const existing = matchingProfiles[0];

    if (existing) {
      await db
        .update(profiles)
        .set({
          role: "admin",
          passwordHash,
          name: name || existing.name,
          phone: phone || existing.phone,
          deletedAt: null,
          updatedAt: new Date(),
        })
        .where(eq(profiles.id, existing.id));

      console.log(`\n✅ Success: Existing account (${existing.id}) has been updated and granted 'admin' privileges.\n`);
    } else {
      const [newAdmin] = await db
        .insert(profiles)
        .values({
          email: normalizedEmail,
          passwordHash,
          name,
          phone,
          role: "admin",
        })
        .returning({ id: profiles.id, email: profiles.email, role: profiles.role });

      console.log(`\n✅ Success: Created new admin user (${newAdmin.id}) with 'admin' privileges.\n`);
    }
  } catch (err) {
    console.error("\n❌ Error provisioning admin:", err);
    process.exit(1);
  } finally {
    await close();
  }
}

main();

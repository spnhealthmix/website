/**
 * Make an existing customer an admin (or remove admin).
 *   npx tsx scripts/grant-admin.ts owner@example.com
 *   npx tsx scripts/grant-admin.ts owner@example.com --revoke
 * The person must have signed in at least once so their profile exists. There is deliberately
 * no admin-management API: roles change only from here, by someone with database access.
 */
import * as fs from "node:fs";
import { and, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { profiles } from "../src/lib/db/schema";

function loadEnv() {
  if (fs.existsSync(".env")) {
    const lines = fs.readFileSync(".env", "utf-8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx !== -1) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  }
}

loadEnv();

async function main() {
  const [email, flag] = process.argv.slice(2);
  if (!email || !process.env.DATABASE_URL) {
    throw new Error("Usage: DATABASE_URL=... npx tsx scripts/grant-admin.ts <email> [--revoke]");
  }
  const role = flag === "--revoke" ? "customer" : "admin";
  const db = getDb(process.env.DATABASE_URL);
  const rows = await db
    .update(profiles)
    .set({ role })
    .where(and(sql`lower(${profiles.email}) = ${email.toLowerCase()}`, isNull(profiles.deletedAt)))
    .returning({ id: profiles.id, email: profiles.email, role: profiles.role });
  if (rows.length === 0) throw new Error(`No active profile with email ${email}. Have they signed in once?`);
  console.log(`${rows[0].email} is now: ${rows[0].role}`);
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});

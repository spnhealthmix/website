import { sql } from "drizzle-orm";
import { profiles } from "@/lib/db/schema";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function profileEmailMatches(email: string) {
  return sql`lower(${profiles.email}) = ${normalizeEmail(email)}`;
}

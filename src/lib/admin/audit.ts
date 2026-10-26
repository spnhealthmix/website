import { adminAuditLog } from "../db/schema";
import type { AnyDb } from "../orders/common";

export type AuditEntry = {
  actorProfileId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
};

export async function writeAudit(db: AnyDb, entry: AuditEntry) {
  await db.insert(adminAuditLog).values({
    actorProfileId: entry.actorProfileId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? {},
  });
}

export function diff<T extends Record<string, unknown>>(before: T, patch: Partial<T>): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const [key, toVal] of Object.entries(patch)) {
    if (toVal !== undefined && (before as any)[key] !== toVal) {
      changes[key] = { from: (before as any)[key], to: toVal };
    }
  }
  return changes;
}

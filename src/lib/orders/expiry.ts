import { and, asc, eq, lt } from "drizzle-orm";
import { orders } from "../db/schema";
import type { AnyDb } from "./common";
import { releaseOrderStock } from "./stock";

/**
 * Cancel pending_payment orders whose expires_at has passed and give their stock
 * back. Run from a Cloudflare Cron Trigger (see src/worker/scheduled.ts).
 *
 * Safe to overlap with itself, with checkout, and with payment webhooks: every
 * release re-checks the order under a row lock (see releaseOrderStock).
 */
export async function expirePendingOrders(
  db: AnyDb,
  opts: { now?: Date; batchSize?: number; graceMinutes?: number } = {},
): Promise<{ examined: number; released: number }> {
  // graceMinutes: don't cancel in the last moments of someone's payment. The cron
  // passes 5; the late-payment path in applyCapturedPayment still covers anything later.
  const now = new Date((opts.now ?? new Date()).getTime() - (opts.graceMinutes ?? 0) * 60_000);
  const due = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(eq(orders.status, "pending_payment"), eq(orders.stockReleased, false), lt(orders.expiresAt, now)),
    )
    .orderBy(asc(orders.expiresAt))
    .limit(opts.batchSize ?? 100);

  let released = 0;
  for (const { id } of due) {
    // One failure must not stop the rest of the batch.
    try {
      const r = await releaseOrderStock(db, id, { reason: "expired" });
      if (r.released) released++;
    } catch (err) {
      console.error(`expirePendingOrders: failed to release order ${id}`, err);
    }
  }
  return { examined: due.length, released };
}

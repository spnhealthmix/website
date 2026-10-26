import { and, eq, gte, sql } from "drizzle-orm";
import { orderItems, orders, productVariants } from "../db/schema";
import type { AnyDb } from "./common";

/**
 * THE oversell guard. One statement: the stock check and the decrement happen
 * together under the row lock Postgres takes for UPDATE. If two requests race for
 * the last unit, the second waits, re-checks `stock >= qty` against the new row
 * value, matches nothing, and gets `null`.
 *
 * Returns the variant's price/sku/label as they were when the stock was taken, so
 * the order snapshot always matches the unit actually reserved.
 */
export async function decrementStock(db: AnyDb, variantId: string, quantity: number) {
  const rows = await db
    .update(productVariants)
    .set({ stock: sql`${productVariants.stock} - ${quantity}` })
    .where(
      and(
        eq(productVariants.id, variantId),
        eq(productVariants.isActive, true),
        gte(productVariants.stock, quantity),
      ),
    )
    .returning({
      id: productVariants.id,
      sku: productVariants.sku,
      label: productVariants.label,
      pricePaise: productVariants.pricePaise,
    });
  return rows[0] ?? null;
}

export type ReleaseResult =
  | { released: true }
  | { released: false; reason: "not_found" | "already_released" | "not_pending" };

/**
 * Cancel a pending_payment order and put its stock back. Safe to call any number of
 * times, from any number of places (Razorpay failure, cron, customer cancel):
 *
 *  - the order row is locked, so concurrent callers (and a concurrent payment
 *    confirmation) are serialised;
 *  - `stock_released` makes the restore happen at most once;
 *  - only orders still in `pending_payment` are touched, so a paid order can never
 *    be cancelled or restocked by this path.
 */
export async function releaseOrderStock(
  db: AnyDb,
  orderId: string,
  opts: { reason: string },
): Promise<ReleaseResult> {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) return { released: false, reason: "not_found" } as const;
    if (order.stockReleased) return { released: false, reason: "already_released" } as const;
    if (order.status !== "pending_payment") return { released: false, reason: "not_pending" } as const;

    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    for (const item of items) {
      if (!item.variantId) continue; // variant was deleted since; nothing to restore
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
        .where(eq(productVariants.id, item.variantId));
    }

    await tx
      .update(orders)
      .set({ status: "cancelled", stockReleased: true, cancelReason: opts.reason })
      .where(eq(orders.id, orderId));

    return { released: true } as const;
  });
}

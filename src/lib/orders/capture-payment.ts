import { and, asc, eq, sql } from "drizzle-orm";
import { consumeCartForOrder } from "../cart/cart";
import { coupons, orderItems, orders, payments, webhookEvents } from "../db/schema";
import type { AnyDb } from "./common";
import { decrementStock } from "./stock";

export type CapturedPayment = {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  amountPaise: number;
  method?: string | null;
};

export type CaptureOutcome =
  | "confirmed" // normal case: paid inside the window
  | "confirmed_after_restock" // paid after expiry; stock was still available and has been re-reserved
  | "refund_required" // money received but the order can't be fulfilled; admin must refund
  | "already_processed" // same payment seen before (idempotent replay)
  | "unknown_order"; // no payments row for this Razorpay order

class RestockFailed extends Error {}

/** Thrown (and the transaction rolled back) when a payment names a Razorpay order we have no record of. */
export class UnknownPaymentOrderError extends Error {
  constructor(public readonly razorpayOrderId: string) {
    super(`No payment record for Razorpay order ${razorpayOrderId}`);
    this.name = "UnknownPaymentOrderError";
  }
}

/**
 * Apply a verified, successful Razorpay payment to our records. Call it only after
 * the webhook signature has been verified.
 *
 * Never silently drops money: every path that cannot fulfil the order marks the
 * payment `refund_required` and sets `orders.attention_reason` so it shows up for
 * an admin.
 *
 * Idempotent, and safe against the expiry cron running at the same moment: the
 * order row is locked first, the same lock releaseOrderStock takes.
 */
export async function applyCapturedPayment(
  db: AnyDb,
  p: CapturedPayment,
): Promise<{ outcome: CaptureOutcome; orderId?: string }> {
  return db.transaction(async (tx) => {
    // Find the order without locking, then lock order -> payment (always this order).
    const [link] = await tx
      .select({ orderId: payments.orderId })
      .from(payments)
      .where(eq(payments.razorpayOrderId, p.razorpayOrderId));
    if (!link) return { outcome: "unknown_order" as const };

    const [order] = await tx.select().from(orders).where(eq(orders.id, link.orderId)).for("update");
    const [payment] = await tx
      .select()
      .from(payments)
      .where(eq(payments.razorpayOrderId, p.razorpayOrderId))
      .for("update");

    // Replay of a payment we already recorded.
    if (payment.razorpayPaymentId === p.razorpayPaymentId && payment.status !== "created") {
      return { outcome: "already_processed" as const, orderId: order.id };
    }

    const flagForRefund = async (attention: string) => {
      if (payment.status === "captured") {
        // A *different* payment hit an order that is already paid. Don't touch the
        // legitimate payment row (one row per Razorpay order); just tell the admin
        // which extra payment id to refund.
        await tx
          .update(orders)
          .set({ attentionReason: `${attention}: refund ${p.razorpayPaymentId}` })
          .where(eq(orders.id, order.id));
        return { outcome: "refund_required" as const, orderId: order.id };
      }
      await tx
        .update(payments)
        .set({ status: "refund_required", razorpayPaymentId: p.razorpayPaymentId, method: p.method ?? null })
        .where(eq(payments.id, payment.id));
      await tx.update(orders).set({ attentionReason: attention }).where(eq(orders.id, order.id));
      return { outcome: "refund_required" as const, orderId: order.id };
    };

    // The amount we asked Razorpay to collect must equal what the order says.
    if (p.amountPaise !== order.totalPaise || p.amountPaise !== payment.amountPaise) {
      return flagForRefund("payment_amount_mismatch");
    }

    const markPaid = () =>
      tx
        .update(payments)
        .set({ status: "captured", razorpayPaymentId: p.razorpayPaymentId, method: p.method ?? null })
        .where(eq(payments.id, payment.id));

    // Paid and confirmed: the purchased quantities leave the customer's cart.
    const clearCart = async () =>
      consumeCartForOrder(tx, order.profileId, await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)));

    // Helper to atomically consume coupon usage if order has a coupon attached
    const consumeCouponUsage = async () => {
      if (!order.couponId) return true;
      const res = await tx
        .update(coupons)
        .set({ usedCount: sql`${coupons.usedCount} + 1` })
        .where(
          and(
            eq(coupons.id, order.couponId),
            sql`(${coupons.maxUses} IS NULL OR ${coupons.usedCount} < ${coupons.maxUses})`,
          ),
        )
        .returning({ id: coupons.id });
      return res.length > 0;
    };

    // Normal case.
    if (order.status === "pending_payment") {
      const couponOk = await consumeCouponUsage();
      if (!couponOk) {
        return flagForRefund("coupon_usage_limit_exceeded");
      }

      await markPaid();
      await tx.update(orders).set({ status: "confirmed" }).where(eq(orders.id, order.id));
      await clearCart();
      return { outcome: "confirmed" as const, orderId: order.id };
    }

    // Late payment: order was auto-cancelled by expiry and its stock released.
    if (order.status === "cancelled" && order.stockReleased && order.cancelReason === "expired") {
      const items = await tx
        .select()
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.variantId)); // same lock order as checkout

      let restocked = true;
      try {
        // Savepoint: if any line is short, the lines already taken are rolled back.
        await tx.transaction(async (sp) => {
          for (const item of items) {
            if (!item.variantId || !(await decrementStock(sp, item.variantId, item.quantity))) {
              throw new RestockFailed();
            }
          }
        });
      } catch (err) {
        if (!(err instanceof RestockFailed)) throw err;
        restocked = false;
      }

      if (restocked) {
        const couponOk = await consumeCouponUsage();
        if (!couponOk) {
          return flagForRefund("coupon_usage_limit_exceeded");
        }

        await markPaid();
        await tx
          .update(orders)
          .set({ status: "confirmed", stockReleased: false, cancelReason: null })
          .where(eq(orders.id, order.id));
        await clearCart();
        return { outcome: "confirmed_after_restock" as const, orderId: order.id };
      }
      return flagForRefund("late_payment_no_stock");
    }

    // Anything else (customer-cancelled, a second payment on a confirmed order, ...).
    return flagForRefund("payment_on_non_pending_order");
  });
}

/**
 * Webhook idempotency, built on webhook_events.
 *
 * The event row and the payment/order updates commit together. A duplicate delivery
 * hits the primary key and does nothing. If processing throws, the event row rolls
 * back too, so Razorpay's retry will be processed rather than skipped.
 *
 * Signature verification and HTTP handling belong in the route that calls this.
 */
export async function processCapturedPaymentEvent(
  db: AnyDb,
  event: { eventId: string; eventType: string; payload: unknown; payment: CapturedPayment },
): Promise<{ duplicate: true } | { duplicate: false; outcome: CaptureOutcome; orderId?: string }> {
  return db.transaction(async (tx) => {
    const inserted = await tx
      .insert(webhookEvents)
      .values({ id: event.eventId, eventType: event.eventType, payload: event.payload })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });

    if (inserted.length === 0) return { duplicate: true as const };

    const result = await applyCapturedPayment(tx, event.payment);
    // Roll the event row back too, so Razorpay's retry gets processed instead of being
    // skipped as a duplicate. Covers a webhook that races ahead of our own bookkeeping.
    if (result.outcome === "unknown_order") throw new UnknownPaymentOrderError(event.payment.razorpayOrderId);
    return { duplicate: false as const, ...result };
  });
}

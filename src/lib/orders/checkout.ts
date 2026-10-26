import { payments } from "../db/schema";
import type { PaymentGateway } from "../payments/razorpay";
import { OrderError, type AnyDb } from "./common";
import { createPendingOrder, type CreateOrderInput } from "./create-order";
import { releaseOrderStock } from "./stock";

export type CheckoutResult = {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  amountPaise: number;
  currency: "INR";
  expiresAt: Date;
};

/**
 * 1. Commit order + items + stock (one DB transaction).
 * 2. Only then call Razorpay, outside any DB transaction, so a slow external call
 *    never holds row locks.
 * 3. If step 2 (or recording its result) fails, release the stock immediately via
 *    the same idempotent path the cron uses.
 *
 * If even the release fails (database outage), the order is still pending_payment
 * with an expires_at, so the expiry cron will clean it up.
 */
export async function startCheckout(
  db: AnyDb,
  gateway: PaymentGateway,
  input: CreateOrderInput,
  log: (msg: string, err?: unknown) => void = console.error,
): Promise<CheckoutResult> {
  const order = await createPendingOrder(db, input);

  try {
    const rzp = await gateway.createOrder({
      amountPaise: order.totalPaise,
      receipt: order.orderNumber,
      notes: { order_id: order.orderId },
    });

    await db.insert(payments).values({
      orderId: order.orderId,
      razorpayOrderId: rzp.id,
      amountPaise: order.totalPaise,
      status: "created",
    });

    return {
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      razorpayOrderId: rzp.id,
      amountPaise: order.totalPaise,
      currency: "INR",
      expiresAt: order.expiresAt,
    };
  } catch (err) {
    try {
      await releaseOrderStock(db, order.orderId, { reason: "razorpay_order_failed" });
    } catch (releaseErr) {
      log(`Failed to release stock for order ${order.orderId}; expiry cron will retry`, releaseErr);
    }
    throw new OrderError("PAYMENT_PROVIDER_ERROR", "Could not start payment. Please try again.", undefined, err);
  }
}

import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { orderItems, orders, payments, productImages, shipments, shipmentTrackingEvents, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import type { PaymentGateway } from "../payments/razorpay";
import { verifyCheckoutSignature } from "../payments/signature";
import { applyCapturedPayment } from "../orders/capture-payment";
import { imageUrl } from "../storage/storage";
import { CustomerError } from "./errors";

/**
 * Customer-facing order view. Explicit column list on purpose: admin_note and
 * attention_reason (refund flags etc.) must never reach a customer, and listing columns
 * means a future internal column isn't exposed by accident.
 */
const orderColumns = {
  id: orders.id,
  orderNumber: orders.orderNumber,
  status: orders.status,
  subtotalPaise: orders.subtotalPaise,
  discountPaise: orders.discountPaise,
  shippingPaise: orders.shippingPaise,
  totalPaise: orders.totalPaise,
  shippingAddress: orders.shippingAddress,
  customerNote: orders.customerNote,
  expiresAt: orders.expiresAt,
  createdAt: orders.createdAt,
};

const mine = (profileId: string, orderId: string) => and(eq(orders.id, orderId), eq(orders.profileId, profileId));

async function attachDetails(db: AnyDb, order: { id: string }) {
  const items = await db
    .select({
      id: orderItems.id,
      productId: orderItems.productId,
      productName: orderItems.productName,
      variantLabel: orderItems.variantLabel,
      sku: orderItems.sku,
      unitPricePaise: orderItems.unitPricePaise,
      quantity: orderItems.quantity,
      lineTotalPaise: orderItems.lineTotalPaise,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id));

  const productIds = items.map((i) => i.productId).filter((id): id is string => Boolean(id));
  const imagesMap = new Map<string, string>();
  if (productIds.length > 0) {
    const imgs = await db
      .select({
        productId: productImages.productId,
        r2Key: productImages.r2Key,
      })
      .from(productImages)
      .where(and(inArray(productImages.productId, productIds), eq(productImages.isPrimary, true)));
    const imageBaseUrl = process.env.R2_PUBLIC_BASE_URL;
    for (const img of imgs) {
      if (img.productId && img.r2Key) {
        const url = imageUrl(imageBaseUrl, img.r2Key);
        if (url) {
          imagesMap.set(img.productId, url);
        }
      }
    }
  }

  const itemsWithImages = items.map((item) => ({
    ...item,
    imageUrl: item.productId ? imagesMap.get(item.productId) ?? null : null,
  }));
  const ships = await db
    .select({
      id: shipments.id,
      courierName: shipments.courierName,
      awb: shipments.awb,
      trackingUrl: shipments.trackingUrl,
      status: shipments.status,
      shippedAt: shipments.shippedAt,
      deliveredAt: shipments.deliveredAt,
    })
    .from(shipments)
    .where(eq(shipments.orderId, order.id))
    .orderBy(desc(shipments.createdAt));

  const events = ships.length > 0
    ? await db
        .select({
          id: shipmentTrackingEvents.id,
          shipmentId: shipmentTrackingEvents.shipmentId,
          status: shipmentTrackingEvents.status,
          description: shipmentTrackingEvents.description,
          location: shipmentTrackingEvents.location,
          occurredAt: shipmentTrackingEvents.occurredAt,
        })
        .from(shipmentTrackingEvents)
        .where(inArray(shipmentTrackingEvents.shipmentId, ships.map((s) => s.id)))
        .orderBy(asc(shipmentTrackingEvents.occurredAt))
    : [];

  return {
    items: itemsWithImages,
    shipments: ships.map((s) => ({
      ...s,
      events: events.filter((e) => e.shipmentId === s.id),
    })),
  };
}

export async function listMyOrders(db: AnyDb, profileId: string, opts: { limit?: number; offset?: number } = {}) {
  const userOrders = await db
    .select(orderColumns)
    .from(orders)
    .where(eq(orders.profileId, profileId))
    .orderBy(desc(orders.createdAt))
    .limit(Math.min(opts.limit ?? 20, 50))
    .offset(opts.offset ?? 0);

  if (userOrders.length === 0) return [];

  const orderIds = userOrders.map((o) => o.id);

  // Attach items count & primary product thumbnail
  const items = await db
    .select({
      orderId: orderItems.orderId,
      productId: orderItems.productId,
      productName: orderItems.productName,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(inArray(orderItems.orderId, orderIds));

  const productIds = Array.from(
    new Set(items.map((i) => i.productId).filter((id): id is string => Boolean(id)))
  );

  const imagesMap = new Map<string, string>();
  if (productIds.length > 0) {
    const imgs = await db
      .select({
        productId: productImages.productId,
        r2Key: productImages.r2Key,
      })
      .from(productImages)
      .where(and(inArray(productImages.productId, productIds), eq(productImages.isPrimary, true)));
    const imageBaseUrl = process.env.R2_PUBLIC_BASE_URL;
    for (const img of imgs) {
      if (img.productId && img.r2Key) {
        const url = imageUrl(imageBaseUrl, img.r2Key);
        if (url) imagesMap.set(img.productId, url);
      }
    }

    const prods = await db
      .select({ id: products.id, slug: products.slug })
      .from(products)
      .where(inArray(products.id, productIds));
    for (const p of prods) {
      if (!imagesMap.has(p.id) && p.slug) {
        imagesMap.set(p.id, `/products/${p.slug}/main.jpg`);
      }
    }
  }

  // Shipments for delivery dates
  const ships = await db
    .select({
      orderId: shipments.orderId,
      deliveredAt: shipments.deliveredAt,
      shippedAt: shipments.shippedAt,
    })
    .from(shipments)
    .where(inArray(shipments.orderId, orderIds));

  return userOrders.map((order) => {
    const orderItemRows = items.filter((i) => i.orderId === order.id);
    const itemsCount = orderItemRows.reduce((sum, item) => sum + (item.quantity || 1), 0);
    const firstItem = orderItemRows[0];
    const img = firstItem?.productId ? imagesMap.get(firstItem.productId) ?? null : null;
    const shipment = ships.find((s) => s.orderId === order.id);

    return {
      ...order,
      itemsCount: itemsCount > 0 ? itemsCount : undefined,
      imageUrl: img,
      productName: firstItem?.productName ?? null,
      deliveredAt: shipment?.deliveredAt ? shipment.deliveredAt.toISOString() : null,
      shippedAt: shipment?.shippedAt ? shipment.shippedAt.toISOString() : null,
    };
  });
}

export async function getMyOrder(db: AnyDb, profileId: string, orderId: string) {
  const [order] = await db.select(orderColumns).from(orders).where(mine(profileId, orderId));
  if (!order) throw new CustomerError("ORDER_NOT_FOUND", "Order not found.");
  return { ...order, ...(await attachDetails(db, order)) };
}

export type CallbackResult = {
  orderId: string;
  orderNumber: string;
  status: string;
  /** true while the signed callback is verified but the webhook has not confirmed payment yet */
  awaitingConfirmation: boolean;
};

export class InvalidSignatureError extends Error {}

/**
 * Browser callback after Razorpay Checkout.
 *
 *  1. Ownership first: the Razorpay order must belong to the signed-in customer, else
 *     404 (a stranger learns nothing, not even whether the order exists).
 *  2. Verify Razorpay's signature (HMAC of order_id|payment_id with the key secret).
 *     Invalid -> reject, change nothing.
 *  3. Verify payment capture: if the payment gateway provides capture status and reports
 *     authorized (not captured), retain an accurate pending state and extend hold.
 *  4. Upon verifying payment capture (or in test modes without gateway fetch), atomically
 *     apply the captured payment via applyCapturedPayment. This updates payments.status to "captured",
 *     orders.status to "confirmed", consumes coupons, and clears purchased items from the customer's cart.
 *  5. It is fully idempotent against late or concurrent webhook deliveries (which return already_processed).
 */
export async function verifyCheckoutCallback(
  db: AnyDb,
  profileId: string,
  cb: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  keySecret: string,
  opts: { now?: Date; holdMinutes?: number; gateway?: PaymentGateway } = {},
): Promise<CallbackResult> {
  const [row] = await db
    .select({ orderId: orders.id, totalPaise: orders.totalPaise, status: orders.status })
    .from(payments)
    .innerJoin(orders, eq(orders.id, payments.orderId))
    .where(and(eq(payments.razorpayOrderId, cb.razorpayOrderId), eq(orders.profileId, profileId)));
  if (!row) throw new CustomerError("ORDER_NOT_FOUND", "Order not found.");

  const valid = await verifyCheckoutSignature(
    { razorpayOrderId: cb.razorpayOrderId, razorpayPaymentId: cb.razorpayPaymentId, signature: cb.signature },
    keySecret,
  );
  if (!valid) throw new InvalidSignatureError("Payment signature could not be verified.");

  // If already confirmed (e.g. webhook arrived first), return immediately
  if (row.status !== "pending_payment") {
    const [o] = await db
      .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
      .from(orders)
      .where(eq(orders.id, row.orderId));
    return { orderId: o.id, orderNumber: o.orderNumber, status: o.status, awaitingConfirmation: o.status === "pending_payment" };
  }

  // Verify capture status if the gateway provides payment fetching
  let canConfirm = true;
  let paymentMethod: string | null = null;

  if (opts.gateway?.fetchPayment) {
    const rzpPayment = await opts.gateway.fetchPayment(cb.razorpayPaymentId);
    if (rzpPayment) {
      if (rzpPayment.status !== "captured") {
        // Payment is authorized but not captured, or pending/failed
        canConfirm = false;
      } else if (rzpPayment.amount !== row.totalPaise || rzpPayment.currency !== "INR") {
        // Authoritative amount or currency mismatch
        canConfirm = false;
      } else {
        paymentMethod = rzpPayment.method ?? null;
      }
    }
  }

  if (canConfirm) {
    await applyCapturedPayment(db, {
      razorpayOrderId: cb.razorpayOrderId,
      razorpayPaymentId: cb.razorpayPaymentId,
      amountPaise: row.totalPaise,
      method: paymentMethod,
    });
  } else {
    // Retain accurate pending status and extend hold time so cron doesn't cancel while awaiting capture/webhook
    const holdUntil = new Date((opts.now ?? new Date()).getTime() + (opts.holdMinutes ?? 30) * 60_000).toISOString();
    await db
      .update(orders)
      .set({ expiresAt: sql`GREATEST(${orders.expiresAt}, ${holdUntil}::timestamptz)` })
      .where(and(eq(orders.id, row.orderId), eq(orders.status, "pending_payment")));
  }

  const [o] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status })
    .from(orders)
    .where(eq(orders.id, row.orderId));
  return { orderId: o.id, orderNumber: o.orderNumber, status: o.status, awaitingConfirmation: o.status === "pending_payment" };
}

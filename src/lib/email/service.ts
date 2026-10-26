import { eq } from "drizzle-orm";
import { orderItems, orders, profiles, webhookEvents } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { getEmailProvider } from "./provider";
import type {
  EmailEventPayload,
  EmailMessage,
  EmailOrderItem,
  SendEmailResult,
} from "./types";
import { getSiteUrl } from "./templates/base";
import { renderOrderConfirmationEmail } from "./templates/order-confirmation";
import { renderPaymentSuccessEmail } from "./templates/payment-success";
import { renderPaymentFailedEmail } from "./templates/payment-failed";
import { renderOrderProcessingEmail } from "./templates/order-processing";
import { renderOrderPackedEmail } from "./templates/order-packed";
import { renderOrderShippedEmail } from "./templates/order-shipped";
import { renderOrderOutForDeliveryEmail } from "./templates/order-out-for-delivery";
import { renderOrderDeliveredEmail } from "./templates/order-delivered";
import { renderOrderCancelledEmail } from "./templates/order-cancelled";
import { renderRefundProcessedEmail } from "./templates/refund-processed";

/**
 * Dispatches a transactional email event with idempotency protection.
 * Never throws unhandled exceptions that could break the primary business transaction.
 */
export async function sendTransactionalEmail(
  db: AnyDb,
  event: EmailEventPayload,
): Promise<SendEmailResult> {
  const provider = getEmailProvider();

  let recipientEmail: string;
  let recipientName: string | undefined;
  let entityId: string;
  let rendered: { subject: string; html: string; text: string };

  try {
    switch (event.event) {
      case "ORDER_CONFIRMED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderConfirmationEmail(event.data);
        break;

      case "PAYMENT_SUCCESS":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = `${event.data.orderId}:${event.data.razorpayPaymentId}`;
        rendered = renderPaymentSuccessEmail(event.data);
        break;

      case "PAYMENT_FAILED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = `${event.data.orderId}${event.data.failedAttemptId ? `:${event.data.failedAttemptId}` : ""}`;
        rendered = renderPaymentFailedEmail(event.data);
        break;

      case "ORDER_PROCESSING":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderProcessingEmail(event.data);
        break;

      case "ORDER_PACKED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderPackedEmail(event.data);
        break;

      case "ORDER_SHIPPED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderShippedEmail(event.data);
        break;

      case "ORDER_OUT_FOR_DELIVERY":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderOutForDeliveryEmail(event.data);
        break;

      case "ORDER_DELIVERED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderDeliveredEmail(event.data);
        break;

      case "ORDER_CANCELLED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = event.data.orderId;
        rendered = renderOrderCancelledEmail(event.data);
        break;

      case "REFUND_PROCESSED":
        recipientEmail = event.data.customerEmail;
        recipientName = event.data.customerName;
        entityId = `${event.data.orderId}:${event.data.razorpayPaymentId || "refund"}`;
        rendered = renderRefundProcessedEmail(event.data);
        break;

      default:
        return {
          success: false,
          provider: provider.id,
          error: "Unknown event type",
        };
    }

    const normalizedEmail = recipientEmail ? recipientEmail.trim().toLowerCase() : "";
    if (!normalizedEmail || !normalizedEmail.includes("@") || !normalizedEmail.includes(".")) {
      console.warn(`[Email Service] Skipped: Invalid recipient email for ${event.event}`);
      return {
        success: false,
        provider: provider.id,
        error: "Invalid recipient email",
      };
    }

    // ── Idempotency Check using webhookEvents table ────────────────────────
    // Primary key prevents duplicate sends for the same event and entity
    const idempotencyKey = `email:${event.event}:${entityId}:${normalizedEmail}`;
    const insertResult = await db
      .insert(webhookEvents)
      .values({
        id: idempotencyKey,
        provider: "email",
        eventType: event.event,
        payload: {
          recipient: normalizedEmail,
          entityId,
          event: event.event,
          attemptedAt: new Date().toISOString(),
        },
      })
      .onConflictDoNothing()
      .returning({ id: webhookEvents.id });

    if (insertResult.length === 0) {
      console.log(`[Email Service] Idempotent skip: ${idempotencyKey} already dispatched.`);
      return {
        success: true,
        messageId: idempotencyKey,
        provider: "idempotency-cache",
      };
    }

    // ── Send Email Message ──────────────────────────────────────────────────
    const message: EmailMessage = {
      to: {
        email: normalizedEmail,
        name: recipientName,
      },
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    };

    return await provider.send(message);
  } catch (err: any) {
    // Top-level safety: email errors must never crash caller
    console.error(`[Email Service] Error sending ${event.event}:`, err?.message || err);
    return {
      success: false,
      provider: provider.id,
      error: err?.message || "Internal email delivery error",
    };
  }
}

/**
 * Loads order snapshot data and triggers an email asynchronously.
 */
async function loadOrderSnapshotAndSend(
  db: AnyDb,
  orderId: string,
  createEvent: (orderData: {
    order: typeof orders.$inferSelect;
    customerEmail: string;
    customerName: string;
    items: EmailOrderItem[];
    orderUrl: string;
  }) => EmailEventPayload,
): Promise<void> {
  try {
    const [row] = await db
      .select({
        order: orders,
        customerName: profiles.name,
        customerEmail: profiles.email,
      })
      .from(orders)
      .leftJoin(profiles, eq(profiles.id, orders.profileId))
      .where(eq(orders.id, orderId))
      .limit(1);

    if (!row) {
      console.warn(`[Email Service] Cannot send email: Order ${orderId} not found.`);
      return;
    }

    const itemsRows = await db
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    const siteUrl = getSiteUrl();
    const customerEmail = row.customerEmail;
    if (!customerEmail) {
      console.warn(`[Email Service] Cannot send email: Order ${orderId} has no customer email.`);
      return;
    }
    const customerName = row.customerName || row.order.shippingAddress.fullName || "Valued Customer";
    const orderUrl = `${siteUrl}/account/orders`;

    const items: EmailOrderItem[] = itemsRows.map((it) => ({
      productName: it.productName,
      variantLabel: it.variantLabel,
      quantity: it.quantity,
      unitPricePaise: it.unitPricePaise,
      lineTotalPaise: it.lineTotalPaise,
    }));

    const eventPayload = createEvent({
      order: row.order,
      customerEmail,
      customerName,
      items,
      orderUrl,
    });

    await sendTransactionalEmail(db, eventPayload);
  } catch (err) {
    console.error(`[Email Service] Failed to dispatch order email for ${orderId}:`, err);
  }
}

/* -------------------------------------------------------------------------- */
/* Convenience Trigger Functions for Business Workflows                       */
/* -------------------------------------------------------------------------- */

export function triggerOrderConfirmedEmail(
  db: AnyDb,
  orderId: string,
  paymentMethod?: string | null,
): void {
  // Execute safely without blocking callers
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: "ORDER_CONFIRMED",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      paymentMethod,
    },
  })).catch((e) => console.error(e));
}

export function triggerPaymentSuccessEmail(
  db: AnyDb,
  orderId: string,
  razorpayPaymentId: string,
  amountPaise: number,
  paymentMethod?: string | null,
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: "PAYMENT_SUCCESS",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      razorpayPaymentId,
      amountPaise,
      paidAt: new Date(),
      paymentMethod,
    },
  })).catch((e) => console.error(e));
}

export async function triggerPaymentFailedEmail(
  db: AnyDb,
  razorpayOrderId: string,
  amountPaise: number,
  failedReason?: string | null,
  failedAttemptId?: string | null,
): Promise<void> {
  try {
    const [row] = await db
      .select({
        order: orders,
        customerName: profiles.name,
        customerEmail: profiles.email,
      })
      .from(orders)
      .leftJoin(profiles, eq(profiles.id, orders.profileId))
      .where(eq(orders.idempotencyKey, razorpayOrderId)) // or via payments link
      .limit(1);

    if (row && row.customerEmail) {
      const siteUrl = getSiteUrl();
      await sendTransactionalEmail(db, {
        event: "PAYMENT_FAILED",
        data: {
          orderId: row.order.id,
          orderNumber: row.order.orderNumber,
          customerName: row.customerName || "Customer",
          customerEmail: row.customerEmail,
          amountPaise,
          failedReason,
          retryUrl: `${siteUrl}/checkout`,
          failedAttemptId,
        },
      });
    }
  } catch (err) {
    console.error("[Email Service] Payment failed notification error:", err);
  }
}

export function triggerOrderStatusEmail(
  db: AnyDb,
  orderId: string,
  status: "processing" | "packed",
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: status === "processing" ? "ORDER_PROCESSING" : "ORDER_PACKED",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      status,
    },
  })).catch((e) => console.error(e));
}

export function triggerOrderShippedEmail(
  db: AnyDb,
  orderId: string,
  courierName: string,
  awb: string,
  trackingUrl?: string | null,
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: "ORDER_SHIPPED",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      courierName,
      awb,
      trackingUrl,
      shippedAt: new Date(),
    },
  })).catch((e) => console.error(e));
}

export function triggerOrderOutForDeliveryEmail(
  db: AnyDb,
  orderId: string,
  courierName?: string | null,
  awb?: string | null,
  location?: string | null,
  trackingUrl?: string | null,
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: "ORDER_OUT_FOR_DELIVERY",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      courierName,
      awb,
      location,
      trackingUrl,
    },
  })).catch((e) => console.error(e));
}

export function triggerOrderDeliveredEmail(
  db: AnyDb,
  orderId: string,
  deliveredAt: Date = new Date(),
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => {
    const siteUrl = getSiteUrl();
    return {
      event: "ORDER_DELIVERED",
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerName,
        customerEmail,
        createdAt: order.createdAt,
        items,
        subtotalPaise: order.subtotalPaise,
        discountPaise: order.discountPaise,
        shippingPaise: order.shippingPaise,
        totalPaise: order.totalPaise,
        shippingAddress: order.shippingAddress,
        orderUrl,
        deliveredAt,
        reviewUrl: `${siteUrl}/account/reviews`,
      },
    };
  }).catch((e) => console.error(e));
}

export function triggerOrderCancelledEmail(
  db: AnyDb,
  orderId: string,
  cancelReason?: string | null,
  refundPending: boolean = false,
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: "ORDER_CANCELLED",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      cancelledAt: new Date(),
      cancelReason,
      refundPending,
    },
  })).catch((e) => console.error(e));
}

export function triggerRefundProcessedEmail(
  db: AnyDb,
  orderId: string,
  refundAmountPaise: number,
  razorpayPaymentId?: string | null,
): void {
  loadOrderSnapshotAndSend(db, orderId, ({ order, customerEmail, customerName, items, orderUrl }) => ({
    event: "REFUND_PROCESSED",
    data: {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customerName,
      customerEmail,
      createdAt: order.createdAt,
      items,
      subtotalPaise: order.subtotalPaise,
      discountPaise: order.discountPaise,
      shippingPaise: order.shippingPaise,
      totalPaise: order.totalPaise,
      shippingAddress: order.shippingAddress,
      orderUrl,
      refundAmountPaise,
      refundedAt: new Date(),
      razorpayPaymentId,
    },
  })).catch((e) => console.error(e));
}

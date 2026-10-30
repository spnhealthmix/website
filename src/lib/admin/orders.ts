import { and, asc, desc, eq, gte, ilike, inArray, isNotNull, lt, or, sql, type SQL } from "drizzle-orm";
import { ApiError } from "../api/http";
import {
  adminAuditLog, orderItems, orders, payments, productVariants, profiles, shipmentTrackingEvents, shipments,
} from "../db/schema";
import type { AnyDb } from "../orders/common";
import { releaseOrderStock } from "../orders/stock";
import { writeAudit } from "./audit";
import {
  triggerOrderCancelledEmail,
  triggerOrderDeliveredEmail,
  triggerOrderShippedEmail,
  triggerOrderStatusEmail,
  triggerRefundProcessedEmail,
} from "../email/service";

type OrderStatus = (typeof orders.$inferSelect)["status"];

/* -------------------------------------------------------------------------- */
/* Status rules                                                               */
/* -------------------------------------------------------------------------- */

// Fulfilment only moves forward. Skipping a step is allowed (e.g. confirmed -> packed);
// going back never is. `shipped` needs shipment details and `delivered` needs `shipped`.
const FORWARD: OrderStatus[] = ["confirmed", "processing", "packed", "shipped", "delivered"];
const CANCELLABLE: OrderStatus[] = ["pending_payment", "confirmed", "processing", "packed"];

export function checkTransition(from: OrderStatus, to: string): void {
  const bad = () => new ApiError(409, "INVALID_TRANSITION", `An order that is ${from.replace("_", " ")} cannot be moved to ${to}.`);
  if (to === "cancelled") {
    if (!CANCELLABLE.includes(from)) throw bad();
    return;
  }
  const a = FORWARD.indexOf(from);
  const b = FORWARD.indexOf(to as OrderStatus);
  if (a === -1 || b === -1 || b <= a) throw bad();
  if (to === "delivered" && from !== "shipped") throw bad();
}

/* -------------------------------------------------------------------------- */
/* Listing and detail                                                         */
/* -------------------------------------------------------------------------- */

const like = (s: string) => `%${s.replace(/[\\%_]/g, (m) => "\\" + m)}%`; // user text can't act as wildcards

export type AdminOrderFilters = {
  status?: OrderStatus;
  q?: string;
  from?: Date;
  to?: Date;
  attention?: boolean;
  limit: number;
  offset: number;
};

export async function listAdminOrders(db: AnyDb, f: AdminOrderFilters) {
  const where: (SQL | undefined)[] = [];
  if (f.status) where.push(eq(orders.status, f.status));
  if (f.attention) where.push(isNotNull(orders.attentionReason));
  if (f.from) where.push(gte(orders.createdAt, f.from));
  if (f.to) where.push(lt(orders.createdAt, f.to));
  if (f.q) {
    const pat = like(f.q);
    const digits = f.q.replace(/[\s\-+().]/g, "").replace(/^(91|0)(?=[6-9]\d{9}$)/, "");
    where.push(
      or(
        ilike(orders.orderNumber, pat),
        ilike(profiles.email, pat),
        ilike(profiles.name, pat),
        sql`${orders.shippingAddress}->>'fullName' ILIKE ${pat}`,
        /^[6-9]\d{9}$/.test(digits) ? sql`${orders.shippingAddress}->>'phone' = ${digits}` : undefined,
      ),
    );
  }
  const cond = and(...where);

  const rows = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      status: orders.status,
      totalPaise: orders.totalPaise,
      createdAt: orders.createdAt,
      attentionReason: orders.attentionReason,
      itemCount: sql<number>`(select coalesce(sum(oi.quantity), 0)::int from order_items oi where oi.order_id = ${orders.id})`,
      customer: { id: profiles.id, name: profiles.name, email: profiles.email },
      shipTo: sql<string>`${orders.shippingAddress}->>'fullName'`,
      shipCity: sql<string>`${orders.shippingAddress}->>'city'`,
      shippingAddress: orders.shippingAddress,
    })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.profileId))
    .where(cond)
    .orderBy(desc(orders.createdAt), desc(orders.id))
    .limit(f.limit)
    .offset(f.offset);

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.profileId))
    .where(cond);

  return { orders: rows.map((r) => ({ ...r, needsAttention: r.attentionReason !== null })), total, limit: f.limit, offset: f.offset };
}

export async function getAdminOrder(db: AnyDb, orderId: string) {
  const [row] = await db
    .select({
      order: orders,
      customer: { id: profiles.id, name: profiles.name, email: profiles.email, phone: profiles.phone },
    })
    .from(orders)
    .innerJoin(profiles, eq(profiles.id, orders.profileId))
    .where(eq(orders.id, orderId));
  if (!row) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const pays = await db.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.createdAt));
  const ships = await db.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.createdAt));
  const events = ships.length
    ? await db
        .select()
        .from(shipmentTrackingEvents)
        .where(inArray(shipmentTrackingEvents.shipmentId, ships.map((s) => s.id)))
        .orderBy(asc(shipmentTrackingEvents.occurredAt))
    : [];
  const activity = await db
    .select({
      id: adminAuditLog.id,
      action: adminAuditLog.action,
      details: adminAuditLog.details,
      createdAt: adminAuditLog.createdAt,
      actor: { id: profiles.id, email: profiles.email },
    })
    .from(adminAuditLog)
    .leftJoin(profiles, eq(profiles.id, adminAuditLog.actorProfileId))
    .where(and(eq(adminAuditLog.entityType, "order"), eq(adminAuditLog.entityId, orderId)))
    .orderBy(desc(adminAuditLog.createdAt));

  return {
    ...row.order,
    customer: row.customer,
    items,
    payments: pays,
    shipments: ships.map((s) => ({ ...s, events: events.filter((e) => e.shipmentId === s.id) })),
    activity,
  };
}

/* -------------------------------------------------------------------------- */
/* Status changes                                                             */
/* -------------------------------------------------------------------------- */

export type ShipmentInput = { courierName: string; awb: string; trackingUrl?: string | null };

async function lockOrder(tx: AnyDb, orderId: string) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");
  return o;
}

/**
 * Move an order to its next state. The order row is locked first, so two admins (or a double
 * click) acting at once are applied one after the other against the real current status:
 * the second one sees the new status and gets 409 INVALID_TRANSITION instead of overwriting.
 */
export async function changeOrderStatus(
  db: AnyDb,
  adminId: string,
  orderId: string,
  input: { to: "processing" | "packed" | "shipped" | "delivered" | "cancelled"; note?: string | null; shipment?: ShipmentInput },
) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    const from = order.status;
    checkTransition(from, input.to);

    if (input.to === "cancelled") {
      if (!input.note) throw new ApiError(422, "NOTE_REQUIRED", "Give a reason when cancelling an order.", { note: "A reason is required" });
      await cancelOrder(tx, order);
    } else {
      if (input.to === "shipped") {
        if (!input.shipment) throw new ApiError(422, "SHIPMENT_REQUIRED", "Courier name and tracking number are required to mark an order shipped.");
        const now = new Date();
        const [s] = await tx
          .insert(shipments)
          .values({
            orderId,
            provider: "manual",
            courierName: input.shipment.courierName,
            awb: input.shipment.awb,
            trackingUrl: input.shipment.trackingUrl ?? null,
            status: "in_transit",
            shippedAt: now,
          })
          .returning({ id: shipments.id });
        await tx.insert(shipmentTrackingEvents).values({ shipmentId: s.id, status: "in_transit", description: "Dispatched by seller", occurredAt: now });
      }
      if (input.to === "delivered") {
        const now = new Date();
        const [s] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.createdAt)).limit(1);
        if (s) {
          await tx.update(shipments).set({ status: "delivered", deliveredAt: now }).where(eq(shipments.id, s.id));
          await tx.insert(shipmentTrackingEvents).values({ shipmentId: s.id, status: "delivered", description: "Marked delivered by seller", occurredAt: now });
        }
      }
      await tx.update(orders).set({ status: input.to }).where(eq(orders.id, orderId));
    }

    await writeAudit(tx, {
      actorProfileId: adminId,
      action: "order.status_changed",
      entityType: "order",
      entityId: orderId,
      details: { from, to: input.to, note: input.note ?? null, ...(input.shipment ? { shipment: input.shipment } : {}) },
    });
  });

  // Dispatch lifecycle emails after transaction commits safely
  if (input.to === "processing" || input.to === "packed") {
    triggerOrderStatusEmail(db, orderId, input.to);
  } else if (input.to === "shipped") {
    triggerOrderShippedEmail(
      db,
      orderId,
      input.shipment?.courierName || "Courier",
      input.shipment?.awb || "",
      input.shipment?.trackingUrl,
    );
  } else if (input.to === "delivered") {
    triggerOrderDeliveredEmail(db, orderId);
  }

  return getAdminOrder(db, orderId);
}

/** Runs inside changeOrderStatus's transaction with the order row already locked. */
async function cancelOrder(tx: AnyDb, order: typeof orders.$inferSelect) {
  if (order.status === "pending_payment") {
    // Unpaid: nothing to refund. Same idempotent path the cron and Razorpay failure use.
    await releaseOrderStock(tx, order.id, { reason: "admin_cancelled" });
    return;
  }

  // Paid (confirmed / processing / packed): put the stock back exactly once, and make sure
  // the customer's money is not forgotten: the order enters the refund queue.
  if (!order.stockReleased) {
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.variantId));
    for (const it of items) {
      if (!it.variantId) continue;
      await tx
        .update(productVariants)
        .set({ stock: sql`${productVariants.stock} + ${it.quantity}` })
        .where(eq(productVariants.id, it.variantId));
    }
  }
  await tx
    .update(orders)
    .set({
      status: "cancelled",
      stockReleased: true,
      cancelReason: "admin_cancelled",
      attentionReason: "cancelled_by_admin_refund_due",
      attentionAt: new Date(),
    })
    .where(eq(orders.id, order.id));
  await tx
    .update(payments)
    .set({ status: "refund_required" })
    .where(and(eq(payments.orderId, order.id), eq(payments.status, "captured")));

  triggerOrderCancelledEmail(tx, order.id, "admin_cancelled", true);
}

/* -------------------------------------------------------------------------- */
/* Notes and shipment corrections                                             */
/* -------------------------------------------------------------------------- */

export async function setAdminNote(db: AnyDb, adminId: string, orderId: string, note: string | null) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    await tx.update(orders).set({ adminNote: note }).where(eq(orders.id, orderId));
    await writeAudit(tx, {
      actorProfileId: adminId,
      action: "order.note_changed",
      entityType: "order",
      entityId: orderId,
      details: { from: order.adminNote, to: note },
    });
  });
  return getAdminOrder(db, orderId);
}

export async function updateShipment(
  db: AnyDb,
  adminId: string,
  orderId: string,
  patch: { courierName?: string; awb?: string; trackingUrl?: string | null },
) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (order.status !== "shipped" && order.status !== "delivered") {
      throw new ApiError(409, "NOT_SHIPPED", "Shipment details can only be edited once the order is shipped.");
    }
    const [s] = await tx.select().from(shipments).where(eq(shipments.orderId, orderId)).orderBy(desc(shipments.createdAt)).limit(1);
    if (!s) throw new ApiError(409, "NOT_SHIPPED", "This order has no shipment.");
    await tx.update(shipments).set(patch).where(eq(shipments.id, s.id));
    await writeAudit(tx, {
      actorProfileId: adminId,
      action: "order.shipment_updated",
      entityType: "order",
      entityId: orderId,
      details: { from: { courierName: s.courierName, awb: s.awb, trackingUrl: s.trackingUrl }, to: patch },
    });
  });
  return getAdminOrder(db, orderId);
}

/* -------------------------------------------------------------------------- */
/* Refund-required queue                                                      */
/* -------------------------------------------------------------------------- */

export type RefundKind = "late_payment_no_stock" | "payment_amount_mismatch" | "duplicate_payment" | "admin_cancelled" | "other";

export function refundKind(reason: string): RefundKind {
  if (reason.startsWith("late_payment_no_stock")) return "late_payment_no_stock";
  if (reason.startsWith("payment_amount_mismatch")) return "payment_amount_mismatch";
  if (reason.startsWith("payment_on_non_pending_order")) return "duplicate_payment";
  if (reason.startsWith("cancelled_by_admin_refund_due")) return "admin_cancelled";
  return "other";
}

/** For a duplicate payment the reason carries the extra payment's id: "...: refund pay_XYZ". */
const extraPaymentId = (reason: string) => reason.match(/refund (\S+)$/)?.[1] ?? null;

export async function listRefundQueue(db: AnyDb, q: { state: "open" | "resolved"; limit: number; offset: number }) {
  if (q.state === "open") {
    const rows = await db
      .select({
        orderId: orders.id,
        orderNumber: orders.orderNumber,
        orderStatus: orders.status,
        totalPaise: orders.totalPaise,
        reason: orders.attentionReason,
        flaggedAt: sql<Date>`coalesce(${orders.attentionAt}, ${orders.updatedAt})`,
        customer: { name: profiles.name, email: profiles.email, phone: profiles.phone },
      })
      .from(orders)
      .innerJoin(profiles, eq(profiles.id, orders.profileId))
      .where(isNotNull(orders.attentionReason))
      .orderBy(asc(sql`coalesce(${orders.attentionAt}, ${orders.updatedAt})`), asc(orders.id)) // oldest first
      .limit(q.limit)
      .offset(q.offset);

    const ids = rows.map((r) => r.orderId);
    const pays = ids.length ? await db.select().from(payments).where(inArray(payments.orderId, ids)).orderBy(asc(payments.createdAt)) : [];
    const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(orders).where(isNotNull(orders.attentionReason));

    return {
      state: "open" as const,
      total,
      items: rows.map((r) => {
        const reason = r.reason!;
        const kind = refundKind(reason);
        const mine = pays.filter((p) => p.orderId === r.orderId);
        const flagged = mine.find((p) => p.status === "refund_required") ?? mine[mine.length - 1];
        return {
          orderId: r.orderId,
          orderNumber: r.orderNumber,
          orderStatus: r.orderStatus,
          kind,
          reason,
          flaggedAt: r.flaggedAt,
          customer: r.customer,
          // What to look up in the Razorpay dashboard:
          razorpayPaymentId: kind === "duplicate_payment" ? extraPaymentId(reason) : (flagged?.razorpayPaymentId ?? null),
          razorpayOrderId: flagged?.razorpayOrderId ?? null,
          paymentStatus: flagged?.status ?? null,
          paidAmountPaise: kind === "duplicate_payment" ? null : (flagged?.amountPaise ?? null),
          orderTotalPaise: r.totalPaise,
        };
      }),
    };
  }

  const rows = await db
    .select({
      resolvedAt: adminAuditLog.createdAt,
      details: adminAuditLog.details,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      resolvedBy: profiles.email,
    })
    .from(adminAuditLog)
    .innerJoin(orders, eq(orders.id, adminAuditLog.entityId))
    .leftJoin(profiles, eq(profiles.id, adminAuditLog.actorProfileId))
    .where(eq(adminAuditLog.action, "refund.resolved"))
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(q.limit)
    .offset(q.offset);
  const [{ total }] = await db.select({ total: sql<number>`count(*)::int` }).from(adminAuditLog).where(eq(adminAuditLog.action, "refund.resolved"));
  return { state: "resolved" as const, total, items: rows };
}

/**
 * Record that the customer has been refunded (the admin does the refund in the Razorpay
 * dashboard and records its reference here). Closes the queue item:
 *  - the flagged payment becomes `refunded`;
 *  - a cancelled order becomes `refunded`; a still-unpaid flagged order is cancelled and its
 *    stock released first; a normally fulfilled order (duplicate payment) is left as it is;
 *  - the attention flag clears and the resolution is audited.
 * Idempotent under concurrency: the order is locked, so only one caller can resolve it.
 */
export async function resolveRefund(
  db: AnyDb,
  adminId: string,
  orderId: string,
  input: { reference: string; amountPaise: number; note?: string | null },
) {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, orderId);
    if (!order.attentionReason) throw new ApiError(409, "NOTHING_TO_RESOLVE", "This order has no refund waiting.");
    const kind = refundKind(order.attentionReason);
    if (kind === "other") throw new ApiError(409, "NOT_A_REFUND_ITEM", "This flag is not a refund.");

    const pays = await tx.select().from(payments).where(eq(payments.orderId, orderId)).orderBy(asc(payments.createdAt));
    const target = pays.find((p) => p.status === "refund_required");
    const cap = target?.amountPaise ?? order.totalPaise;
    if (input.amountPaise > cap) {
      throw new ApiError(422, "VALIDATION_FAILED", "Refund amount is more than was paid.", { amountPaise: `At most ${cap} paise` });
    }

    if (target) await tx.update(payments).set({ status: "refunded" }).where(eq(payments.id, target.id));

    if (order.status === "pending_payment") {
      await releaseOrderStock(tx, orderId, { reason: "payment_refunded" });
      await tx.update(orders).set({ status: "refunded" }).where(eq(orders.id, orderId));
    } else if (order.status === "cancelled") {
      await tx.update(orders).set({ status: "refunded" }).where(eq(orders.id, orderId));
    }
    await tx.update(orders).set({ attentionReason: null, attentionAt: null }).where(eq(orders.id, orderId));

    await writeAudit(tx, {
      actorProfileId: adminId,
      action: "refund.resolved",
      entityType: "order",
      entityId: orderId,
      details: {
        kind,
        reason: order.attentionReason,
        reference: input.reference,
        amountPaise: input.amountPaise,
        note: input.note ?? null,
        razorpayPaymentId: target?.razorpayPaymentId ?? extraPaymentId(order.attentionReason),
      },
    });
  });

  // Dispatch refund confirmation email
  triggerRefundProcessedEmail(db, orderId, input.amountPaise, input.reference);

  return getAdminOrder(db, orderId);
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

export async function adminDashboard(db: AnyDb, now = new Date()) {
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const [byStatus, [{ open }], [{ revenue, paidOrders }], [{ low }]] = await Promise.all([
    db.select({ status: orders.status, n: sql<number>`count(*)::int` }).from(orders).groupBy(orders.status),
    db.select({ open: sql<number>`count(*)::int` }).from(orders).where(isNotNull(orders.attentionReason)),
    db
      .select({ revenue: sql<number>`coalesce(sum(${orders.totalPaise}), 0)::float8`, paidOrders: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(inArray(orders.status, ["confirmed", "processing", "packed", "shipped", "delivered"]), gte(orders.createdAt, since))),
    db
      .select({ low: sql<number>`count(*)::int` })
      .from(productVariants)
      .where(and(eq(productVariants.isActive, true), sql`${productVariants.stock} <= 5`)),
  ]);

  const counts: Record<string, number> = {};
  for (const r of byStatus) counts[r.status] = r.n;
  return {
    ordersByStatus: counts,
    toFulfil: (counts.confirmed ?? 0) + (counts.processing ?? 0) + (counts.packed ?? 0),
    openRefunds: open,
    last30Days: { paidOrders, revenuePaise: revenue },
    lowStockVariants: low,
  };
}

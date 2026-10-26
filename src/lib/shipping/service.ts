import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { ApiError } from "../api/http";
import { writeAudit } from "../admin/audit";
import {
  orderItems,
  orders,
  productVariants,
  shipmentTrackingEvents,
  shipments,
  type AddressSnapshot,
} from "../db/schema";
import type { AnyDb } from "../orders/common";
import { extractVariantWeightGrams } from "./calculator";
import { getShippingProvider } from "./provider";
import type { CreateShipmentResult, NormalizedShipmentStatus, NormalizedTrackingEvent } from "./types";
import { triggerOrderShippedEmail } from "../email/service";

export type CreateShipmentOptions = {
  providerId?: string;
  courierName?: string;
  awb?: string;
  trackingUrl?: string;
};

/**
 * Idempotently creates a shipment for an order, synchronizing with the shipping provider
 * and updating the order to "shipped".
 */
export async function createOrderShipment(
  db: AnyDb,
  adminId: string,
  orderId: string,
  opts: CreateShipmentOptions = {},
) {
  return db.transaction(async (tx) => {
    // 1. Lock and validate order
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");

    if (order.status === "pending_payment") {
      throw new ApiError(409, "ORDER_UNPAID", "Cannot create a shipment for an unpaid order.");
    }
    if (order.status === "cancelled" || order.status === "refunded") {
      throw new ApiError(409, "ORDER_CANCELLED", `Cannot create a shipment for a ${order.status} order.`);
    }

    // 2. Check for existing active shipment (idempotency guard)
    const [existingShipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt))
      .limit(1);

    if (existingShipment && existingShipment.awb) {
      // Already has a shipment created with AWB - return existing idempotently
      return {
        alreadyExists: true,
        shipment: existingShipment,
      };
    }

    // 3. Load order items and authoritative weights
    const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, orderId));
    if (items.length === 0) {
      throw new ApiError(400, "NO_ITEMS", "Cannot ship an order with no items.");
    }

    const variantIds = items.map((i) => i.variantId).filter((id): id is string => Boolean(id));
    const variantWeights = variantIds.length > 0
      ? await tx
          .select({
            id: productVariants.id,
            weightGrams: productVariants.weightGrams,
            label: productVariants.label,
          })
          .from(productVariants)
          .where(inArray(productVariants.id, variantIds))
      : [];

    const weightMap = new Map(variantWeights.map((v) => [v.id, extractVariantWeightGrams(v)]));

    let totalWeightGrams = 0;
    const itemSnapshots = items.map((it) => {
      const unitWeight = it.variantId ? weightMap.get(it.variantId) ?? 500 : 500;
      totalWeightGrams += unitWeight * it.quantity;
      return {
        productName: it.productName,
        variantLabel: it.variantLabel,
        sku: it.sku,
        quantity: it.quantity,
        unitPricePaise: it.unitPricePaise,
        weightGrams: unitWeight,
      };
    });

    // 4. Dispatch to provider or manual
    const provider = getShippingProvider(opts.providerId);
    let result: CreateShipmentResult;

    if (provider.id === "manual") {
      if (!opts.courierName || !opts.awb) {
        throw new ApiError(422, "SHIPMENT_REQUIRED", "Courier name and AWB are required for manual shipment.");
      }
      result = await provider.createShipment({
        orderId,
        orderNumber: order.orderNumber,
        shippingAddress: order.shippingAddress,
        items: itemSnapshots,
        subtotalPaise: order.subtotalPaise,
        totalPaise: order.totalPaise,
        totalWeightGrams,
        courierName: opts.courierName,
        awb: opts.awb,
        trackingUrl: opts.trackingUrl,
      });
    } else {
      result = await provider.createShipment({
        orderId,
        orderNumber: order.orderNumber,
        shippingAddress: order.shippingAddress,
        items: itemSnapshots,
        subtotalPaise: order.subtotalPaise,
        totalPaise: order.totalPaise,
        totalWeightGrams,
        courierName: opts.courierName,
        awb: opts.awb,
        trackingUrl: opts.trackingUrl,
      });
    }

    const now = new Date();

    // 5. Insert shipment record
    const [shipmentRow] = await tx
      .insert(shipments)
      .values({
        orderId,
        provider: result.provider,
        externalShipmentId: result.externalShipmentId ?? null,
        courierName: result.courierName,
        awb: result.awb,
        trackingUrl: result.trackingUrl ?? null,
        status: result.status ?? "in_transit",
        shippedAt: now,
      })
      .returning();

    // 6. Record initial tracking event
    await tx.insert(shipmentTrackingEvents).values({
      shipmentId: shipmentRow.id,
      status: result.status ?? "in_transit",
      description: `Dispatched via ${result.courierName} (AWB: ${result.awb})`,
      location: "Fulfillment Center",
      occurredAt: now,
    });

    // 7. Update order status to shipped
    await tx.update(orders).set({ status: "shipped" }).where(eq(orders.id, orderId));

    // 8. Audit log
    await writeAudit(tx, {
      actorProfileId: adminId,
      action: "order.shipment_created",
      entityType: "order",
      entityId: orderId,
      details: {
        provider: result.provider,
        courierName: result.courierName,
        awb: result.awb,
        trackingUrl: result.trackingUrl,
      },
    });

    // 9. Dispatch transactional email notification
    triggerOrderShippedEmail(tx, orderId, result.courierName, result.awb, result.trackingUrl);

    return {
      alreadyExists: false,
      shipment: shipmentRow,
    };
  });
}

/**
 * Synchronizes tracking status from the shipping provider and appends new tracking events.
 * Transitions order to "delivered" when the courier reports delivery.
 */
export async function syncOrderTracking(
  db: AnyDb,
  actorId: string,
  orderId: string,
) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
    if (!order) throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found.");

    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, orderId))
      .orderBy(desc(shipments.createdAt))
      .limit(1);

    if (!shipment || !shipment.awb) {
      throw new ApiError(409, "NO_SHIPMENT", "No active shipment found to synchronize.");
    }

    const provider = getShippingProvider(shipment.provider);
    const tracking = await provider.getTracking(shipment.awb, shipment.externalShipmentId ?? undefined);

    // Load existing events to deduplicate
    const existingEvents = await tx
      .select()
      .from(shipmentTrackingEvents)
      .where(eq(shipmentTrackingEvents.shipmentId, shipment.id));

    const existingKeys = new Set(
      existingEvents.map((e) => `${e.status}|${e.occurredAt.toISOString()}|${e.description || ""}`),
    );

    const newEvents = tracking.events.filter(
      (ev) => !existingKeys.has(`${ev.status}|${ev.occurredAt.toISOString()}|${ev.description || ""}`),
    );

    if (newEvents.length > 0) {
      await tx.insert(shipmentTrackingEvents).values(
        newEvents.map((ev) => ({
          shipmentId: shipment.id,
          status: ev.status,
          description: ev.description,
          location: ev.location ?? null,
          occurredAt: ev.occurredAt,
        })),
      );
    }

    // Update shipment status
    const now = new Date();
    const updates: Partial<typeof shipments.$inferInsert> = {
      status: tracking.status,
    };

    if (tracking.status === "delivered" && !shipment.deliveredAt) {
      updates.deliveredAt = tracking.deliveredAt ?? now;
    }

    await tx.update(shipments).set(updates).where(eq(shipments.id, shipment.id));

    // Order state synchronization: delivered shipment transitions shipped order to delivered
    if (tracking.status === "delivered" && order.status === "shipped") {
      await tx.update(orders).set({ status: "delivered" }).where(eq(orders.id, orderId));
    }

    await writeAudit(tx, {
      actorProfileId: actorId === "webhook" || actorId === "system" ? null : actorId,
      action: "order.tracking_refreshed",
      entityType: "order",
      entityId: orderId,
      details: {
        awb: shipment.awb,
        status: tracking.status,
        newEventsCount: newEvents.length,
      },
    });

    return {
      shipmentId: shipment.id,
      awb: shipment.awb,
      status: tracking.status,
      newEventsCount: newEvents.length,
    };
  });
}

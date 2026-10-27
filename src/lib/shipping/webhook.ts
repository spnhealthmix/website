import { desc, eq } from "drizzle-orm";
import { orders, shipmentTrackingEvents, shipments, webhookEvents } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { getShippingProvider } from "./provider";
import { triggerOrderDeliveredEmail, triggerOrderOutForDeliveryEmail } from "../email/service";
import { isUniqueViolation } from "../api/http";

export type ShippingWebhookDeps = {
  providerId?: string;
  withDb: <T>(fn: (db: AnyDb) => Promise<T>) => Promise<T>;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};

const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export async function handleShippingWebhook(req: Request, deps: ShippingWebhookDeps): Promise<Response> {
  const log = deps.log ?? ((m, e) => console.error(m, e));

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const provider = getShippingProvider(deps.providerId);

  // 1. Signature Verification
  const valid = await provider.verifyWebhookSignature(req, raw);
  if (!valid) {
    log("shipping webhook: invalid signature", { provider: provider.id });
    return json(400, { error: "invalid_signature" });
  }

  // 2. Parse payload
  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const parsed = provider.parseWebhook(payload);
  if (!parsed) {
    log("shipping webhook: unparseable payload", { provider: provider.id });
    return json(400, { error: "unparseable_payload" });
  }

  // 3. Process with idempotency
  return deps.withDb(async (db) => {
    // Idempotency: try to record event first
    try {
      await db.insert(webhookEvents).values({
        id: parsed.eventId,
        provider: parsed.provider,
        eventType: parsed.status,
        payload: payload as any,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        // Unique violation -> already processed this exact event
        return json(200, { status: "duplicate", eventId: parsed.eventId });
      }
      log("shipping webhook: database insert failed", {
        eventId: parsed.eventId,
        error: err instanceof Error ? err.message : String(err),
      });
      return json(500, { error: "database_error" });
    }

    // Lookup shipment
    let shipmentRow: typeof shipments.$inferSelect | undefined;
    if (parsed.awb) {
      const [s] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.awb, parsed.awb))
        .orderBy(desc(shipments.createdAt))
        .limit(1);
      shipmentRow = s;
    }

    if (!shipmentRow && parsed.externalShipmentId) {
      const [s] = await db
        .select()
        .from(shipments)
        .where(eq(shipments.externalShipmentId, parsed.externalShipmentId))
        .orderBy(desc(shipments.createdAt))
        .limit(1);
      shipmentRow = s;
    }

    if (!shipmentRow) {
      log("shipping webhook: shipment not found", { awb: parsed.awb, extId: parsed.externalShipmentId });
      // Acknowledge with 200 so provider does not needlessly retry unknown shipments
      return json(200, { status: "ignored_unknown_shipment" });
    }

    // Append tracking event
    await db.insert(shipmentTrackingEvents).values({
      shipmentId: shipmentRow.id,
      status: parsed.event.status,
      description: parsed.event.description,
      location: parsed.event.location ?? null,
      occurredAt: parsed.event.occurredAt,
    });

    // Update shipment status
    const updates: Partial<typeof shipments.$inferInsert> = {
      status: parsed.status,
    };
    if (parsed.status === "delivered" && !shipmentRow.deliveredAt) {
      updates.deliveredAt = parsed.event.occurredAt;
    }
    await db.update(shipments).set(updates).where(eq(shipments.id, shipmentRow.id));

    // Order state synchronization & email notification
    if (parsed.status === "out_for_delivery") {
      triggerOrderOutForDeliveryEmail(
        db,
        shipmentRow.orderId,
        shipmentRow.courierName,
        shipmentRow.awb,
        parsed.event.location ?? null,
        shipmentRow.trackingUrl ?? null,
      );
    } else if (parsed.status === "delivered") {
      const [order] = await db.select().from(orders).where(eq(orders.id, shipmentRow.orderId));
      if (order && order.status !== "delivered") {
        if (order.status === "shipped") {
          await db.update(orders).set({ status: "delivered" }).where(eq(orders.id, order.id));
        }
        triggerOrderDeliveredEmail(db, shipmentRow.orderId, parsed.event.occurredAt);
      }
    }

    return json(200, { status: "processed", outcome: parsed.status });
  });
}

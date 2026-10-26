import { and, eq } from "drizzle-orm";
import { payments, webhookEvents } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { processCapturedPaymentEvent } from "../orders/capture-payment";
import { verifyWebhookSignature } from "./signature";
import {
  triggerOrderConfirmedEmail,
  triggerPaymentFailedEmail,
  triggerPaymentSuccessEmail,
} from "../email/service";

export type WebhookDeps = {
  webhookSecret: string;
  /** Opens a db connection for this request and always closes it afterwards. */
  withDb: <T>(fn: (db: AnyDb) => Promise<T>) => Promise<T>;
  log?: (msg: string, extra?: Record<string, unknown>) => void;
};

const MAX_BODY_BYTES = 256 * 1024;

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

type PaymentEntity = {
  id?: unknown;
  order_id?: unknown;
  amount?: unknown;
  currency?: unknown;
  method?: unknown;
  error_description?: unknown;
};

/**
 * Razorpay webhook endpoint logic.
 *
 * Status codes matter: Razorpay retries any non-2xx for up to 24h.
 *   400  bad/missing signature or unusable request (retrying will not help)
 *   200  handled, duplicate, or an event we deliberately ignore
 *   500  something we want retried (database error, payment for an order we can't find yet)
 *
 * Order of operations: size check -> verify signature over the RAW body -> only then parse.
 * Nothing in the payload is trusted before the signature passes.
 */
export async function handleRazorpayWebhook(req: Request, deps: WebhookDeps): Promise<Response> {
  const log = deps.log ?? ((m, e) => console.error(m, e));

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const valid = await verifyWebhookSignature(raw, req.headers.get("x-razorpay-signature"), deps.webhookSecret);
  if (!valid) {
    log("razorpay webhook: invalid signature");
    return json(400, { error: "invalid_signature" });
  }

  // Razorpay sends a unique id per event; it is our idempotency key.
  const eventId = req.headers.get("x-razorpay-event-id");
  if (!eventId) return json(400, { error: "missing_event_id" });

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const eventType = typeof payload?.event === "string" ? payload.event : "";
  const entity: PaymentEntity | undefined = payload?.payload?.payment?.entity;

  try {
    if (eventType === "payment.captured") {
      if (
        typeof entity?.id !== "string" ||
        typeof entity?.order_id !== "string" ||
        !Number.isInteger(entity?.amount) ||
        entity?.currency !== "INR"
      ) {
        log("razorpay webhook: malformed payment.captured", { eventId });
        return json(400, { error: "malformed_payment_entity" });
      }

      const result = await deps.withDb((db) =>
        processCapturedPaymentEvent(db, {
          eventId,
          eventType,
          payload,
          payment: {
            razorpayOrderId: entity.order_id as string,
            razorpayPaymentId: entity.id as string,
            amountPaise: entity.amount as number,
            method: typeof entity.method === "string" ? entity.method : null,
          },
        }),
      );

      if (!result.duplicate && result.outcome === "refund_required") {
        // Money received that we couldn't fulfil. Surface loudly; admin panel reads attention_reason.
        log("razorpay webhook: REFUND REQUIRED", { eventId, orderId: result.orderId });
      }

      // Dispatch order confirmation and payment success emails safely
      if (
        !result.duplicate &&
        (result.outcome === "confirmed" || result.outcome === "confirmed_after_restock") &&
        result.orderId
      ) {
        try {
          await deps.withDb(async (db) => {
            await triggerOrderConfirmedEmail(db, result.orderId!, typeof entity.method === "string" ? entity.method : null);
            await triggerPaymentSuccessEmail(
              db,
              result.orderId!,
              entity.id as string,
              entity.amount as number,
              typeof entity.method === "string" ? entity.method : null,
            );
          });
        } catch (e) {
          log("email notification dispatch failed", { error: String(e) });
        }
      }

      return json(200, result.duplicate ? { status: "duplicate" } : { status: result.outcome });
    }

    if (eventType === "payment.failed" && typeof entity?.order_id === "string") {
      // A failed attempt is not final: Razorpay lets the customer retry on the same order.
      // So: keep the order pending (stock stays held until expires_at), just record why.
      await deps.withDb((db) =>
        db.transaction(async (tx) => {
          const ins = await tx
            .insert(webhookEvents)
            .values({ id: eventId, eventType, payload })
            .onConflictDoNothing()
            .returning({ id: webhookEvents.id });
          if (ins.length === 0) return;
          await tx
            .update(payments)
            .set({ failureReason: typeof entity.error_description === "string" ? entity.error_description.slice(0, 500) : "payment_failed" })
            .where(and(eq(payments.razorpayOrderId, entity.order_id as string), eq(payments.status, "created")));
        }),
      );

      // Trigger payment failed transactional email
      deps
        .withDb(async (db) => {
          await triggerPaymentFailedEmail(
            db,
            entity.order_id as string,
            typeof entity.amount === "number" ? entity.amount : 0,
            typeof entity.error_description === "string" ? entity.error_description : null,
            entity.id as string | undefined,
          );
        })
        .catch((e) => log("payment failed email dispatch failed", { error: String(e) }));

      return json(200, { status: "recorded" });
    }

    // order.paid, payment.authorized, refund.* ...: acknowledged, no action in this version.
    return json(200, { status: "ignored", event: eventType });

  } catch (err) {
    log("razorpay webhook: processing failed, asking Razorpay to retry", {
      eventId,
      eventType,
      error: err instanceof Error ? `${err.name}: ${err.message}` : String(err),
    });
    return json(500, { error: "processing_failed" });
  }
}

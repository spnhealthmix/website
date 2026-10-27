import { describe, it, expect, vi } from "vitest";
import { ShiprocketShippingProvider } from "../src/lib/shipping/shiprocket";
import { handleShippingWebhook } from "../src/lib/shipping/webhook";
import { registerShippingProvider } from "../src/lib/shipping/provider";
import { createHmac } from "node:crypto";

describe("SPN-SEC-004: Shiprocket Webhook Deterministic Idempotency", () => {
  const webhookSecret = "sr_webhook_secret_test";
  process.env.SHIPROCKET_WEBHOOK_SECRET = webhookSecret;

  const provider = new ShiprocketShippingProvider();
  (provider as any).config = { webhookSecret };
  registerShippingProvider(provider);

  describe("Deterministic Event ID derivation (without Date.now())", () => {
    it("generates identical event IDs for identical payloads without provider event_id", () => {
      const payload = {
        awb: "AWB123456789",
        current_status: "IN TRANSIT",
        current_status_id: 6,
        shipment_id: "SHIP98765",
        scans: [
          {
            date: "2026-10-27 10:00:00",
            status: "IN TRANSIT",
            activity: "Departed processing hub",
            location: "Coimbatore Hub",
          },
        ],
      };

      const parsed1 = provider.parseWebhook(payload);
      const parsed2 = provider.parseWebhook(payload);

      expect(parsed1).not.toBeNull();
      expect(parsed2).not.toBeNull();
      expect(parsed1!.eventId).toBe(parsed2!.eventId);
      expect(parsed1!.eventId.startsWith("sr_AWB123456789_in_transit_")).toBe(true);
      expect(parsed1!.eventId).not.toContain("NaN");
    });

    it("generates distinct event IDs for distinct legitimate progress scans", () => {
      const scan1 = {
        awb: "AWB123456789",
        current_status: "IN TRANSIT",
        current_status_id: 6,
        scans: [
          {
            date: "2026-10-27 10:00:00",
            status: "IN TRANSIT",
            activity: "Departed hub 1",
            location: "Coimbatore",
          },
        ],
      };

      const scan2 = {
        awb: "AWB123456789",
        current_status: "IN TRANSIT",
        current_status_id: 6,
        scans: [
          {
            date: "2026-10-27 15:30:00",
            status: "IN TRANSIT",
            activity: "Arrived at hub 2",
            location: "Chennai",
          },
        ],
      };

      const parsed1 = provider.parseWebhook(scan1);
      const parsed2 = provider.parseWebhook(scan2);

      expect(parsed1!.eventId).not.toBe(parsed2!.eventId);
    });

    it("generates distinct event IDs for status transitions (e.g. out_for_delivery -> delivered)", () => {
      const ofd = {
        awb: "AWB123456789",
        current_status: "OUT FOR DELIVERY",
        current_status_id: 17,
        current_timestamp: "2026-10-27 09:00:00",
      };

      const del = {
        awb: "AWB123456789",
        current_status: "DELIVERED",
        current_status_id: 7,
        current_timestamp: "2026-10-27 14:00:00",
      };

      const parsedOfd = provider.parseWebhook(ofd);
      const parsedDel = provider.parseWebhook(del);

      expect(parsedOfd!.status).toBe("out_for_delivery");
      expect(parsedDel!.status).toBe("delivered");
      expect(parsedOfd!.eventId).not.toBe(parsedDel!.eventId);
    });

    it("preserves explicit provider event_id when provided by the carrier", () => {
      const payload = {
        event_id: "sr_carrier_event_777888",
        awb: "AWB123456789",
        current_status: "DELIVERED",
      };

      const parsed = provider.parseWebhook(payload);
      expect(parsed!.eventId).toBe("sr_carrier_event_777888");
    });
  });

  describe("Webhook Handler Idempotency & Error Handling", () => {
    function makeSignedRequest(body: Record<string, unknown>) {
      const raw = JSON.stringify(body);
      const signature = createHmac("sha256", webhookSecret).update(raw).digest("hex");
      return new Request("https://spnhealthmix.in/api/webhooks/shipping", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-shiprocket-signature": signature,
        },
        body: raw,
      });
    }

    it("acknowledges duplicate deliveries with 200 duplicate when event is already recorded", async () => {
      const payload = {
        awb: "AWB999000",
        current_status: "DELIVERED",
        current_timestamp: "2026-10-27 12:00:00",
      };

      const insertedEvents: string[] = [];
      const mockDb: any = {
        insert: (table: any) => ({
          values: async (vals: any) => {
            if (insertedEvents.includes(vals.id)) {
              // Simulate PostgreSQL unique constraint violation error 23505
              const err: any = new Error("Unique constraint violation");
              err.code = "23505";
              throw err;
            }
            insertedEvents.push(vals.id);
            return [];
          },
        }),
        select: () => {
          const chain: any = {
            from: () => chain,
            leftJoin: () => chain,
            where: () => chain,
            orderBy: () => chain,
            limit: async () => [
              {
                id: "ship_1",
                orderId: "order_1",
                awb: "AWB999000",
                status: "in_transit",
                courierName: "Delhivery",
              },
            ],
            then: (resolve: any) =>
              resolve([
                {
                  id: "order_1",
                  status: "shipped",
                  customerEmail: "customer@example.com",
                  customerName: "Test Customer",
                  orderNumber: "SPN-1001",
                  currency: "INR",
                  totalPaise: 45000,
                  subtotalPaise: 45000,
                  discountPaise: 0,
                  shippingPaise: 0,
                },
              ]),
          };
          return chain;
        },
        update: () => ({
          set: () => ({
            where: async () => [],
          }),
        }),
      };

      // First webhook delivery
      const req1 = makeSignedRequest(payload);
      const res1 = await handleShippingWebhook(req1, {
        providerId: "shiprocket",
        withDb: async (fn) => fn(mockDb),
      });
      expect(res1.status).toBe(200);
      const body1 = await res1.json();
      expect(body1.status).toBe("processed");

      // Repeated duplicate delivery of identical payload
      const req2 = makeSignedRequest(payload);
      const res2 = await handleShippingWebhook(req2, {
        providerId: "shiprocket",
        withDb: async (fn) => fn(mockDb),
      });
      expect(res2.status).toBe(200);
      const body2 = await res2.json();
      expect(body2.status).toBe("duplicate");
      expect(body2.eventId).toBe(body1.outcome ? body2.eventId : body1.eventId);
    });

    it("fails closed with 500 when database failure is NOT a unique violation", async () => {
      const payload = {
        awb: "AWB999111",
        current_status: "IN TRANSIT",
        current_timestamp: "2026-10-27 12:00:00",
      };

      const mockDb: any = {
        insert: () => ({
          values: async () => {
            // Unrelated DB failure (e.g. connection lost, disk full)
            const err: any = new Error("Connection terminated unexpectedly");
            err.code = "ECONNRESET";
            throw err;
          },
        }),
      };

      const req = makeSignedRequest(payload);
      const res = await handleShippingWebhook(req, {
        providerId: "shiprocket",
        withDb: async (fn) => fn(mockDb),
        log: () => {},
      });

      expect(res.status).toBe(500);
      const body = await res.json();
      expect(body.error).toBe("database_error");
    });
  });
});

import { createHmac } from "node:crypto";
import type { ShippingProvider } from "./provider";
import type {
  CancelShipmentResult,
  CreateShipmentInput,
  CreateShipmentResult,
  NormalizedShipmentStatus,
  ServiceabilityCheck,
  ShippingRateQuote,
  TrackingResult,
  WebhookEventResult,
} from "./types";

export class MockShippingProvider implements ShippingProvider {
  readonly id = "mock";
  readonly name = "Mock Shipping Provider";

  private configured = true;
  private secret = "mock_shipping_secret";

  // In-memory tracking store for testing
  public trackingStore = new Map<string, TrackingResult>();

  isConfigured(): boolean {
    return this.configured;
  }

  setConfigured(value: boolean): void {
    this.configured = value;
  }

  async checkServiceability(destinationPincode: string, _weightGrams: number): Promise<ServiceabilityCheck> {
    if (destinationPincode === "999999" || destinationPincode.startsWith("00")) {
      return {
        serviceable: false,
        message: "Delivery is currently unavailable for this pincode.",
      };
    }
    return {
      serviceable: true,
      courierName: "Delhivery Air",
      estimatedDays: 3,
      city: "Chennai",
      state: "Tamil Nadu",
    };
  }

  async calculateRate(
    destinationPincode: string,
    weightGrams: number,
    orderValuePaise: number,
  ): Promise<ShippingRateQuote> {
    if (destinationPincode === "999999" || destinationPincode.startsWith("00")) {
      return {
        serviceable: false,
        ratePaise: 0,
        message: "Delivery is currently unavailable for this pincode.",
      };
    }

    // Default mock rate: flat 5000 paise (Rs 50), free over 100000 paise (Rs 1000)
    const isFree = orderValuePaise >= 100000;
    const baseRate = weightGrams > 1000 ? 8000 : 5000;

    return {
      serviceable: true,
      ratePaise: isFree ? 0 : baseRate,
      courierName: "Delhivery Surface",
      estimatedDays: 3,
      freeShipping: isFree,
    };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    const awb = input.awb || `MOCK-AWB-${input.orderNumber.replace(/[^A-Z0-9]/g, "")}`;
    const courier = input.courierName || "Delhivery Surface";
    const trackingUrl = `https://track.mockcourier.test/${awb}`;

    const result: CreateShipmentResult = {
      provider: this.id,
      externalShipmentId: `ext_shp_${Date.now()}`,
      courierName: courier,
      awb,
      trackingUrl,
      status: "created",
    };

    this.trackingStore.set(awb, {
      status: "created",
      courierName: courier,
      awb,
      trackingUrl,
      events: [
        {
          status: "created",
          description: "Shipment manifest generated",
          location: "Warehouse Hub, Chennai",
          occurredAt: new Date(),
        },
      ],
      deliveredAt: null,
    });

    return result;
  }

  async getTracking(awb: string, _externalShipmentId?: string): Promise<TrackingResult> {
    const existing = this.trackingStore.get(awb);
    if (existing) return existing;

    return {
      status: "in_transit",
      courierName: "Delhivery Surface",
      awb,
      trackingUrl: `https://track.mockcourier.test/${awb}`,
      events: [
        {
          status: "created",
          description: "Manifest created",
          location: "Chennai Hub",
          occurredAt: new Date(Date.now() - 86400000),
        },
        {
          status: "in_transit",
          description: "Package in transit to delivery station",
          location: "Bengaluru Sort Center",
          occurredAt: new Date(),
        },
      ],
      deliveredAt: null,
    };
  }

  async cancelShipment(_externalShipmentId: string, awb?: string): Promise<CancelShipmentResult> {
    if (awb && this.trackingStore.has(awb)) {
      const data = this.trackingStore.get(awb)!;
      data.status = "failed";
      data.events.push({
        status: "failed",
        description: "Shipment cancelled by seller",
        location: "Warehouse Hub",
        occurredAt: new Date(),
      });
    }
    return { success: true };
  }

  async verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    const sig = req.headers.get("x-mock-shipping-signature") || req.headers.get("x-shiprocket-signature");
    if (!sig) return false;
    const computed = createHmac("sha256", this.secret).update(rawBody).digest("hex");
    return computed === sig;
  }

  parseWebhook(payload: unknown): WebhookEventResult | null {
    if (!payload || typeof payload !== "object") return null;
    const data = payload as any;
    const awb = data.awb || data.awb_code;
    if (!awb) return null;

    const status: NormalizedShipmentStatus = data.status || "in_transit";
    const eventId = String(data.event_id || `mock_evt_${awb}_${Date.now()}`);

    return {
      eventId,
      provider: this.id,
      externalShipmentId: data.external_shipment_id || data.shipment_id,
      awb,
      orderNumber: data.order_number,
      status,
      event: {
        status,
        description: data.description || `Tracking updated to ${status.replace("_", " ")}`,
        location: data.location || "In Transit Facility",
        occurredAt: data.occurred_at ? new Date(data.occurred_at) : new Date(),
      },
    };
  }
}

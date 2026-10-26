import type { ShippingProvider } from "./provider";
import type {
  CancelShipmentResult,
  CreateShipmentInput,
  CreateShipmentResult,
  ServiceabilityCheck,
  ShippingRateQuote,
  TrackingResult,
  WebhookEventResult,
} from "./types";

export class ManualShippingProvider implements ShippingProvider {
  readonly id = "manual";
  readonly name = "Manual / Direct Courier";

  isConfigured(): boolean {
    return true;
  }

  async checkServiceability(_destinationPincode: string, _weightGrams: number): Promise<ServiceabilityCheck> {
    return { serviceable: true };
  }

  async calculateRate(
    _destinationPincode: string,
    _weightGrams: number,
    _orderValuePaise: number,
  ): Promise<ShippingRateQuote> {
    return { serviceable: true, ratePaise: 0 };
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (!input.courierName || !input.awb) {
      throw new Error("Courier partner and AWB number are required for manual shipment dispatch.");
    }

    return {
      provider: this.id,
      courierName: input.courierName,
      awb: input.awb,
      trackingUrl: input.trackingUrl || null,
      status: "in_transit",
    };
  }

  async getTracking(awb: string, _externalShipmentId?: string): Promise<TrackingResult> {
    return {
      status: "in_transit",
      awb,
      events: [],
    };
  }

  async cancelShipment(_externalShipmentId: string, _awb?: string): Promise<CancelShipmentResult> {
    return { success: true };
  }

  async verifyWebhookSignature(_req: Request, _rawBody: string): Promise<boolean> {
    return false;
  }

  parseWebhook(_payload: unknown): WebhookEventResult | null {
    return null;
  }
}

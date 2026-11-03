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

/**
 * Validates destination postal PIN code and package weight for standard courier delivery.
 * Applies authoritative Indian postal circle rules and rejects test or invalid patterns.
 */
export function checkManualServiceability(
  destinationPincode: string,
  weightGrams: number,
): ServiceabilityCheck {
  const cleanPin = (destinationPincode || "").trim().replace(/\s/g, "");

  // 1. PIN code must be a 6-digit Indian postal code starting with 1-9
  if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
    return {
      serviceable: false,
      message: "Delivery is currently unavailable for this pincode.",
    };
  }

  // 2. Reject known invalid/test PIN codes and prefixes
  if (cleanPin === "999999" || cleanPin.startsWith("00") || cleanPin.startsWith("99")) {
    return {
      serviceable: false,
      message: "Delivery is currently unavailable for this pincode.",
    };
  }

  // 3. Weight validation: package weight must be a positive integer/number
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return {
      serviceable: false,
      message: "Package weight must be greater than zero.",
    };
  }

  // 4. Regional circle identification for state resolution
  const isTN = /^6[0-4]\d{4}$/.test(cleanPin);

  return {
    serviceable: true,
    courierName: "Standard Courier",
    estimatedDays: undefined,
    state: isTN ? "Tamil Nadu" : undefined,
  };
}

export class ManualShippingProvider implements ShippingProvider {
  readonly id = "manual";
  readonly name = "Manual / Direct Courier";

  isConfigured(): boolean {
    return true;
  }

  async checkServiceability(destinationPincode: string, weightGrams: number): Promise<ServiceabilityCheck> {
    return checkManualServiceability(destinationPincode, weightGrams);
  }

  async calculateRate(
    destinationPincode: string,
    weightGrams: number,
    _orderValuePaise: number,
  ): Promise<ShippingRateQuote> {
    const serviceability = await this.checkServiceability(destinationPincode, weightGrams);
    if (!serviceability.serviceable) {
      return {
        serviceable: false,
        ratePaise: 0,
        message: serviceability.message,
      };
    }

    return {
      serviceable: true,
      ratePaise: 0,
      courierName: serviceability.courierName,
      estimatedDays: serviceability.estimatedDays,
    };
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

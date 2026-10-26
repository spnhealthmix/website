import type {
  CancelShipmentResult,
  CreateShipmentInput,
  CreateShipmentResult,
  ServiceabilityCheck,
  ShippingRateQuote,
  TrackingResult,
  WebhookEventResult,
} from "./types";

export interface ShippingProvider {
  readonly id: string;
  readonly name: string;

  /** True if the provider has all required credentials configured. */
  isConfigured(): boolean;

  /** Check if delivery is possible to the destination pincode for the package weight. */
  checkServiceability(destinationPincode: string, weightGrams: number): Promise<ServiceabilityCheck>;

  /** Calculate shipping rate quote for given pincode, weight, and order value. */
  calculateRate(
    destinationPincode: string,
    weightGrams: number,
    orderValuePaise: number,
  ): Promise<ShippingRateQuote>;

  /** Create a shipment with the provider, generating an AWB / tracking number. */
  createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult>;

  /** Retrieve the latest tracking updates for an AWB. */
  getTracking(awb: string, externalShipmentId?: string): Promise<TrackingResult>;

  /** Cancel an existing shipment if supported by provider. */
  cancelShipment(externalShipmentId: string, awb?: string): Promise<CancelShipmentResult>;

  /** Verify webhook signature against the raw body. */
  verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean>;

  /** Parse and normalize webhook payload into a standardized event. */
  parseWebhook(payload: unknown): WebhookEventResult | null;
}

import { ShiprocketShippingProvider } from "./shiprocket";
import { MockShippingProvider } from "./mock";
import { ManualShippingProvider } from "./manual";

const registry = new Map<string, ShippingProvider>();

let initialized = false;
function ensureDefaultProviders() {
  if (initialized) return;
  initialized = true;
  registerShippingProvider(new ShiprocketShippingProvider());
  registerShippingProvider(new MockShippingProvider());
  registerShippingProvider(new ManualShippingProvider());
}

export function registerShippingProvider(provider: ShippingProvider): void {
  registry.set(provider.id.toLowerCase(), provider);
}

export function getShippingProvider(providerId?: string): ShippingProvider {
  ensureDefaultProviders();
  const defaultProvider =
    process.env.SHIPPING_PROVIDER || (process.env.NODE_ENV === "test" ? "mock" : "shiprocket");
  const targetId = (providerId || defaultProvider).toLowerCase();
  const provider = registry.get(targetId);
  if (!provider) {
    const fallback = registry.get("mock") || registry.get("manual");
    if (fallback) return fallback;
    throw new Error(`Shipping provider '${targetId}' not registered and no fallback available.`);
  }
  return provider;
}



import { createHmac, timingSafeEqual } from "node:crypto";
import type { ShippingProvider } from "./provider";
import type {
  CancelShipmentResult,
  CreateShipmentInput,
  CreateShipmentResult,
  NormalizedShipmentStatus,
  NormalizedTrackingEvent,
  ServiceabilityCheck,
  ShippingRateQuote,
  TrackingResult,
  WebhookEventResult,
} from "./types";

interface ShiprocketAuthConfig {
  email?: string;
  password?: string;
  webhookSecret?: string;
  originPincode?: string;
  baseUrl?: string;
}

export class ShiprocketShippingProvider implements ShippingProvider {
  readonly id = "shiprocket";
  readonly name = "Shiprocket";

  private token: string | null = null;
  private tokenExpiresAt: number = 0;
  private config: ShiprocketAuthConfig;

  constructor(config?: ShiprocketAuthConfig) {
    this.config = {
      email: config?.email ?? process.env.SHIPROCKET_EMAIL,
      password: config?.password ?? process.env.SHIPROCKET_PASSWORD,
      webhookSecret: config?.webhookSecret ?? process.env.SHIPROCKET_WEBHOOK_SECRET,
      originPincode: config?.originPincode ?? process.env.SHIPPING_ORIGIN_PINCODE ?? "600001",
      baseUrl: config?.baseUrl ?? process.env.SHIPROCKET_BASE_URL ?? "https://apiv2.shiprocket.in/v1/external",
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.email && this.config.password);
  }

  private async getAuthToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error("Shiprocket credentials (SHIPROCKET_EMAIL and SHIPROCKET_PASSWORD) are not configured.");
    }

    const now = Date.now();
    if (this.token && this.tokenExpiresAt > now + 300_000) {
      return this.token;
    }

    const res = await fetch(`${this.config.baseUrl}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: this.config.email,
        password: this.config.password,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Shiprocket auth failed (${res.status}): ${errText || "Invalid credentials"}`);
    }

    const data = (await res.json()) as { token?: string };
    if (!data.token) {
      throw new Error("Shiprocket auth response did not include a valid token.");
    }

    this.token = data.token;
    // Shiprocket tokens are valid for 10 days; cache for 9 days
    this.tokenExpiresAt = now + 9 * 24 * 60 * 60 * 1000;
    return this.token;
  }

  /**
   * Normalizes Shiprocket status codes/strings to internal shipmentStatus.
   */
  normalizeStatus(status: string | number | undefined): NormalizedShipmentStatus {
    if (status === undefined || status === null) return "created";

    const s = String(status).trim().toUpperCase();

    // Numeric Shiprocket status IDs
    if (s === "1" || s === "2" || s === "3" || s === "5" || s === "42" || s === "46") return "created";
    if (s === "4") return "picked_up";
    if (s === "6" || s === "18" || s === "38") return "in_transit";
    if (s === "17") return "out_for_delivery";
    if (s === "7") return "delivered";
    if (s === "8") return "failed";
    if (s === "9" || s === "10" || s === "11") return "returned";

    // Text status values
    if (s.includes("DELIVERED") && !s.includes("RTO")) return "delivered";
    if (s.includes("OUT FOR DELIVERY")) return "out_for_delivery";
    if (s.includes("IN TRANSIT") || s.includes("REACHED") || s.includes("SHIPPED")) return "in_transit";
    if (s.includes("PICKED UP")) return "picked_up";
    if (s.includes("RTO") || s.includes("RETURN")) return "returned";
    if (s.includes("CANCEL") || s.includes("FAILED") || s.includes("UNDELIVERED")) return "failed";

    return "created";
  }

  async checkServiceability(destinationPincode: string, weightGrams: number): Promise<ServiceabilityCheck> {
    if (destinationPincode === "999999" || destinationPincode.startsWith("00") || destinationPincode.startsWith("99")) {
      return {
        serviceable: false,
        message: "Delivery is currently unavailable for this pincode.",
      };
    }

    if (!this.isConfigured()) {
      return {
        serviceable: true,
        message: "Live Shiprocket credentials not configured; using standard serviceability.",
      };
    }


    try {
      const token = await this.getAuthToken();
      const weightKg = Math.max(0.1, weightGrams / 1000).toFixed(2);
      const url = `${this.config.baseUrl}/courier/serviceability/?pickup_postcode=${this.config.originPincode}&delivery_postcode=${encodeURIComponent(destinationPincode)}&weight=${weightKg}&cod=0`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return { serviceable: false, message: "Delivery is currently unavailable for this pincode." };
      }

      const data = (await res.json()) as any;
      const companies = data?.data?.available_courier_companies;
      if (!Array.isArray(companies) || companies.length === 0) {
        return { serviceable: false, message: "Delivery is currently unavailable for this pincode." };
      }

      const best = companies[0];
      return {
        serviceable: true,
        courierName: best.courier_name,
        estimatedDays: best.etd ? Number.parseInt(String(best.etd), 10) : undefined,
      };
    } catch (err) {
      console.error("Shiprocket serviceability error:", err);
      // Fallback message preventing client crash
      return { serviceable: false, message: "Delivery is currently unavailable for this pincode." };
    }
  }

  async calculateRate(
    destinationPincode: string,
    weightGrams: number,
    _orderValuePaise: number,
  ): Promise<ShippingRateQuote> {
    if (!this.isConfigured()) {
      return {
        serviceable: true,
        ratePaise: 0,
        message: "Live Shiprocket pricing not configured.",
      };
    }

    try {
      const token = await this.getAuthToken();
      const weightKg = Math.max(0.1, weightGrams / 1000).toFixed(2);
      const url = `${this.config.baseUrl}/courier/serviceability/?pickup_postcode=${this.config.originPincode}&delivery_postcode=${encodeURIComponent(destinationPincode)}&weight=${weightKg}&cod=0`;

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return {
          serviceable: false,
          ratePaise: 0,
          message: "Delivery is currently unavailable for this pincode.",
        };
      }

      const data = (await res.json()) as any;
      const companies = data?.data?.available_courier_companies;
      if (!Array.isArray(companies) || companies.length === 0) {
        return {
          serviceable: false,
          ratePaise: 0,
          message: "Delivery is currently unavailable for this pincode.",
        };
      }

      const cheapest = [...companies].sort((a, b) => Number(a.rate) - Number(b.rate))[0];
      const ratePaise = Math.round(Number(cheapest.rate || 0) * 100);

      return {
        serviceable: true,
        ratePaise,
        courierName: cheapest.courier_name,
        estimatedDays: cheapest.etd ? Number.parseInt(String(cheapest.etd), 10) : undefined,
      };
    } catch (err) {
      console.error("Shiprocket calculateRate error:", err);
      return {
        serviceable: false,
        ratePaise: 0,
        message: "Delivery is currently unavailable for this pincode.",
      };
    }
  }

  async createShipment(input: CreateShipmentInput): Promise<CreateShipmentResult> {
    if (!this.isConfigured()) {
      throw new Error("Shiprocket credentials are not configured. Use manual dispatch or configure SHIPROCKET_EMAIL.");
    }

    const token = await this.getAuthToken();
    const weightKg = Math.max(0.1, input.totalWeightGrams / 1000);
    const addr = input.shippingAddress;

    const payload = {
      order_id: input.orderNumber,
      order_date: new Date().toISOString().slice(0, 19).replace("T", " "),
      pickup_location: "Primary",
      billing_customer_name: addr.fullName,
      billing_last_name: "",
      billing_address: addr.line1,
      billing_address_2: addr.line2 || addr.landmark || "",
      billing_city: addr.city,
      billing_pincode: addr.pincode,
      billing_state: addr.state,
      billing_country: "India",
      billing_email: "orders@spnfoods.in",
      billing_phone: addr.phone,
      shipping_is_billing: true,
      order_items: input.items.map((item) => ({
        name: `${item.productName} (${item.variantLabel})`,
        sku: item.sku,
        units: item.quantity,
        selling_price: Math.round(item.unitPricePaise / 100),
      })),
      payment_method: "Prepaid",
      sub_total: Math.round(input.subtotalPaise / 100),
      length: 15,
      breadth: 15,
      height: 10,
      weight: weightKg,
    };

    const res = await fetch(`${this.config.baseUrl}/orders/create/adhoc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Shiprocket order creation failed (${res.status}): ${errText}`);
    }

    const data = (await res.json()) as any;
    const shipmentId = String(data.shipment_id || data.order_id || "");
    const awb = String(data.awb_code || data.awb || shipmentId);
    const courier = data.courier_name || "Shiprocket Partner";

    return {
      provider: this.id,
      externalShipmentId: shipmentId,
      courierName: courier,
      awb,
      trackingUrl: awb ? `https://shiprocket.co/tracking/${encodeURIComponent(awb)}` : null,
      status: "created",
    };
  }

  async getTracking(awb: string, _externalShipmentId?: string): Promise<TrackingResult> {
    if (!this.isConfigured()) {
      return {
        status: "created",
        awb,
        trackingUrl: `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`,
        events: [],
      };
    }

    const token = await this.getAuthToken();
    const res = await fetch(`${this.config.baseUrl}/courier/track/awb/${encodeURIComponent(awb)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      throw new Error(`Shiprocket tracking failed (${res.status}) for AWB ${awb}`);
    }

    const data = (await res.json()) as any;
    const trackData = data?.tracking_data;
    const rawStatus = trackData?.shipment_track?.[0]?.current_status || trackData?.shipment_status;
    const normalized = this.normalizeStatus(rawStatus);

    const activities: any[] = trackData?.shipment_track_activities || [];
    const events: NormalizedTrackingEvent[] = activities.map((act) => ({
      status: this.normalizeStatus(act.activity),
      description: String(act.activity || "In transit"),
      location: act.location ? String(act.location) : null,
      occurredAt: act.date ? new Date(act.date) : new Date(),
    }));

    return {
      status: normalized,
      courierName: trackData?.courier_name,
      awb,
      trackingUrl: `https://shiprocket.co/tracking/${encodeURIComponent(awb)}`,
      events,
      deliveredAt: normalized === "delivered" ? new Date() : null,
    };
  }

  async cancelShipment(externalShipmentId: string, _awb?: string): Promise<CancelShipmentResult> {
    if (!this.isConfigured()) {
      return { success: true, message: "Shipment marked cancelled locally." };
    }

    const token = await this.getAuthToken();
    const res = await fetch(`${this.config.baseUrl}/orders/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ ids: [externalShipmentId] }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return { success: false, message: `Shiprocket cancel failed: ${errText}` };
    }

    return { success: true };
  }

  async verifyWebhookSignature(req: Request, rawBody: string): Promise<boolean> {
    if (!this.config.webhookSecret) {
      // If secret is not set, reject external webhook calls for safety
      return false;
    }

    const safeCompare = (a: string, b: string): boolean => {
      const bufA = Buffer.from(a, "utf-8");
      const bufB = Buffer.from(b, "utf-8");
      if (bufA.length !== bufB.length) return false;
      return timingSafeEqual(bufA, bufB);
    };

    // Shiprocket supports x-api-key token header or HMAC sha256 signature
    const apiKey = req.headers.get("x-api-key");
    if (apiKey && safeCompare(apiKey, this.config.webhookSecret)) {
      return true;
    }

    const signature = req.headers.get("x-shiprocket-signature") || req.headers.get("x-webhook-signature");
    if (signature) {
      const computed = createHmac("sha256", this.config.webhookSecret).update(rawBody).digest("hex");
      return safeCompare(computed, signature);
    }

    return false;
  }

  parseWebhook(payload: unknown): WebhookEventResult | null {
    if (!payload || typeof payload !== "object") return null;

    const data = payload as any;
    const awb = data.awb || data.awb_code;
    const shipmentId = data.shipment_id || data.order_id;
    const currentStatus = data.current_status || data.status;

    if (!awb && !shipmentId) return null;

    const normalized = this.normalizeStatus(currentStatus);
    const eventId = String(data.event_id || `${awb || shipmentId}_${normalized}_${Date.now()}`);

    return {
      eventId,
      provider: this.id,
      externalShipmentId: shipmentId ? String(shipmentId) : undefined,
      awb: awb ? String(awb) : undefined,
      orderNumber: data.order_id ? String(data.order_id) : undefined,
      status: normalized,
      event: {
        status: normalized,
        description: data.scans?.[0]?.activity || `Status updated to ${normalized.replace("_", " ")}`,
        location: data.scans?.[0]?.location || data.current_city || null,
        occurredAt: data.scans?.[0]?.date ? new Date(data.scans[0].date) : new Date(),
      },
    };
  }
}

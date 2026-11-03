import { describe, expect, it } from "vitest";
import {
  extractVariantWeightGrams,
  isTamilNadu,
} from "../src/lib/shipping/calculator";
import {
  ManualShippingProvider,
  checkManualServiceability,
} from "../src/lib/shipping/manual";
import { getShippingProvider, registerShippingProvider } from "../src/lib/shipping/provider";
import { ShiprocketShippingProvider } from "../src/lib/shipping/shiprocket";

describe("Phase 8: Shipping Independence & Serviceability Validation", () => {
  const manual = new ManualShippingProvider();

  describe("PIN Code Format & Serviceability Rules", () => {
    it("accepts valid 6-digit Indian PIN codes across postal circles without misleading ETAs", async () => {
      // Tamil Nadu postal circle (60-64)
      const tn1 = await manual.checkServiceability("600001", 500); // Chennai
      expect(tn1.serviceable).toBe(true);
      expect(tn1.state).toBe("Tamil Nadu");
      expect(tn1.estimatedDays).toBeUndefined();

      const tn2 = await manual.checkServiceability("641001", 1000); // Coimbatore
      expect(tn2.serviceable).toBe(true);
      expect(tn2.state).toBe("Tamil Nadu");
      expect(tn2.estimatedDays).toBeUndefined();

      const tn3 = await manual.checkServiceability("625001", 750); // Madurai
      expect(tn3.serviceable).toBe(true);
      expect(tn3.state).toBe("Tamil Nadu");
      expect(tn3.estimatedDays).toBeUndefined();

      // Non-Tamil Nadu postal circles
      const blr = await manual.checkServiceability("560001", 500); // Bengaluru, Karnataka
      expect(blr.serviceable).toBe(true);
      expect(blr.estimatedDays).toBeUndefined();

      const del = await manual.checkServiceability("110001", 500); // New Delhi
      expect(del.serviceable).toBe(true);
      expect(del.estimatedDays).toBeUndefined();

      const mum = await manual.checkServiceability("400001", 500); // Mumbai, Maharashtra
      expect(mum.serviceable).toBe(true);
      expect(mum.estimatedDays).toBeUndefined();

      const kol = await manual.checkServiceability("700001", 500); // Kolkata, West Bengal
      expect(kol.serviceable).toBe(true);
      expect(kol.estimatedDays).toBeUndefined();
    });

    it("rejects non-numeric, malformed, or wrong-length PIN codes", async () => {
      const empty = await manual.checkServiceability("", 500);
      expect(empty.serviceable).toBe(false);
      expect(empty.message).toBe("Delivery is currently unavailable for this pincode.");

      const short = await manual.checkServiceability("60001", 500);
      expect(short.serviceable).toBe(false);

      const long = await manual.checkServiceability("6000001", 500);
      expect(long.serviceable).toBe(false);

      const alpha = await manual.checkServiceability("60000A", 500);
      expect(alpha.serviceable).toBe(false);

      const special = await manual.checkServiceability("600-01", 500);
      expect(special.serviceable).toBe(false);
    });

    it("rejects known blacklisted, test, or invalid PIN codes", async () => {
      // 999999 test PIN
      const testPin = await manual.checkServiceability("999999", 500);
      expect(testPin.serviceable).toBe(false);
      expect(testPin.message).toBe("Delivery is currently unavailable for this pincode.");

      // Starting with 00 (invalid Indian postal circle)
      const zeroPin = await manual.checkServiceability("001234", 500);
      expect(zeroPin.serviceable).toBe(false);

      // Starting with 99 (army / test range)
      const armyPin = await manual.checkServiceability("990001", 500);
      expect(armyPin.serviceable).toBe(false);
    });

    it("validates weight limits accurately without unsupported 50 kg restriction", async () => {
      // Normal weight
      const normal = await manual.checkServiceability("600001", 1000);
      expect(normal.serviceable).toBe(true);

      // Valid heavy shipments (> 50 kg) are no longer arbitrarily rejected
      const heavy = await manual.checkServiceability("600001", 50001);
      expect(heavy.serviceable).toBe(true);

      const bulk = await manual.checkServiceability("600001", 75000); // 75 kg
      expect(bulk.serviceable).toBe(true);

      // 0, negative, or invalid non-finite weight must be rejected
      const zeroWeight = await manual.checkServiceability("600001", 0);
      expect(zeroWeight.serviceable).toBe(false);
      expect(zeroWeight.message).toContain("Package weight must be greater than zero");

      const negWeight = await manual.checkServiceability("600001", -50);
      expect(negWeight.serviceable).toBe(false);
      expect(negWeight.message).toContain("Package weight must be greater than zero");

      const nanWeight = await manual.checkServiceability("600001", Number.NaN);
      expect(nanWeight.serviceable).toBe(false);
      expect(nanWeight.message).toContain("Package weight must be greater than zero");
    });
  });

  describe("Shipping Provider Resolution & Decoupling", () => {
    it("ManualShippingProvider is always configured and independent of credentials", () => {
      expect(manual.isConfigured()).toBe(true);
      expect(manual.id).toBe("manual");
      expect(manual.name).toBe("Manual / Direct Courier");
    });

    it("resolves manual provider when explicitly requested", () => {
      const provider = getShippingProvider("manual");
      expect(provider.id).toBe("manual");
      expect(provider.isConfigured()).toBe(true);
    });

    it("resolves shiprocket provider if explicitly requested (preserving backward compatibility)", () => {
      const provider = getShippingProvider("shiprocket");
      expect(provider.id).toBe("shiprocket");
    });

    it("Shiprocket provider without credentials reports not configured without throwing", () => {
      const origEmail = process.env.SHIPROCKET_EMAIL;
      const origPass = process.env.SHIPROCKET_PASSWORD;
      try {
        delete process.env.SHIPROCKET_EMAIL;
        delete process.env.SHIPROCKET_PASSWORD;
        const unconfigured = new ShiprocketShippingProvider({ email: "", password: "" });
        expect(unconfigured.isConfigured()).toBe(false);
      } finally {
        if (origEmail) process.env.SHIPROCKET_EMAIL = origEmail;
        if (origPass) process.env.SHIPROCKET_PASSWORD = origPass;
      }
    });

    it("manual shipment dispatch creates valid tracking record without external API calls", async () => {
      const res = await manual.createShipment({
        orderId: "ord_test_123",
        orderNumber: "ORD-2026-0001",
        shippingAddress: {
          fullName: "Customer Test",
          phone: "9876543210",
          line1: "123 Anna Salai",
          city: "Chennai",
          state: "Tamil Nadu",
          pincode: "600001",
        },
        items: [
          {
            productName: "Health Mix Standard",
            variantLabel: "500g",
            sku: "SPN-500G",
            quantity: 2,
            unitPricePaise: 25000,
            weightGrams: 500,
          },
        ],
        subtotalPaise: 50000,
        totalPaise: 50000,
        totalWeightGrams: 1000,
        courierName: "India Post Speed Post",
        awb: "SP123456789IN",
        trackingUrl: "https://www.indiapost.gov.in/_layouts/15/dpt.cpt.tracking/tracking.aspx",
      });

      expect(res.provider).toBe("manual");
      expect(res.courierName).toBe("India Post Speed Post");
      expect(res.awb).toBe("SP123456789IN");
      expect(res.status).toBe("in_transit");
    });

    it("manual shipment throws if courierName or AWB is missing", async () => {
      await expect(
        manual.createShipment({
          orderId: "ord_1",
          orderNumber: "ORD-1",
          shippingAddress: { fullName: "A", phone: "1", line1: "1", city: "C", state: "S", pincode: "600001" },
          items: [],
          subtotalPaise: 1000,
          totalPaise: 1000,
          totalWeightGrams: 500,
        }),
      ).rejects.toThrow("Courier partner and AWB number are required for manual shipment dispatch.");
    });
  });

  describe("State & Zone Identification (isTamilNadu)", () => {
    it("accurately identifies Tamil Nadu from state strings", () => {
      expect(isTamilNadu("Tamil Nadu")).toBe(true);
      expect(isTamilNadu("tamil nadu")).toBe(true);
      expect(isTamilNadu("TamilNadu")).toBe(true);
      expect(isTamilNadu("TN")).toBe(true);
      expect(isTamilNadu({ state: "Tamil Nadu" })).toBe(true);
      expect(isTamilNadu({ state: "tn" })).toBe(true);
    });

    it("accurately identifies Tamil Nadu from PIN code prefixes 60-64", () => {
      expect(isTamilNadu({ pincode: "600001" })).toBe(true);
      expect(isTamilNadu({ pincode: "610001" })).toBe(true);
      expect(isTamilNadu({ pincode: "620001" })).toBe(true);
      expect(isTamilNadu({ pincode: "630001" })).toBe(true);
      expect(isTamilNadu({ pincode: "643253" })).toBe(true);
    });

    it("accurately rejects non-Tamil Nadu states and PIN codes", () => {
      expect(isTamilNadu("Karnataka")).toBe(false);
      expect(isTamilNadu("Kerala")).toBe(false);
      expect(isTamilNadu("Delhi")).toBe(false);
      expect(isTamilNadu("Maharashtra")).toBe(false);
      expect(isTamilNadu({ state: "Karnataka", pincode: "560001" })).toBe(false);
      expect(isTamilNadu({ state: "Delhi", pincode: "110001" })).toBe(false);
      expect(isTamilNadu({ pincode: "560001" })).toBe(false);
      expect(isTamilNadu({ pincode: "670001" })).toBe(false); // Kerala
    });
  });

  describe("Weight Extraction Logic", () => {
    it("extracts weight correctly from weightGrams property or variant label", () => {
      expect(extractVariantWeightGrams({ weightGrams: 1000 })).toBe(1000);
      expect(extractVariantWeightGrams({ weightGrams: 250 })).toBe(250);
      expect(extractVariantWeightGrams({ label: "500 g" })).toBe(500);
      expect(extractVariantWeightGrams({ label: "250g" })).toBe(250);
      expect(extractVariantWeightGrams({ label: "1 kg" })).toBe(1000);
      expect(extractVariantWeightGrams({ label: "1.5 kg" })).toBe(1500);
      expect(extractVariantWeightGrams({ label: "Special Jar" })).toBe(500); // fallback
    });
  });
});

import { eq, inArray } from "drizzle-orm";
import { productVariants, siteSettings } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { getShippingProvider } from "./provider";
import type { ShippingRateQuote } from "./types";

/**
 * Extracts numeric weight in grams from variant record or fallback label parsing.
 * Never trusts any client-submitted weight.
 */
export function extractVariantWeightGrams(variant: { weightGrams?: number | null; label?: string }): number {
  if (typeof variant.weightGrams === "number" && variant.weightGrams > 0) {
    return variant.weightGrams;
  }

  // Parse common Indian e-commerce label formats: "250 g", "500 g", "1 kg", "1.5 kg"
  if (variant.label) {
    const kgMatch = variant.label.match(/([\d.]+)\s*kg/i);
    if (kgMatch) {
      const kg = Number.parseFloat(kgMatch[1]);
      if (!Number.isNaN(kg) && kg > 0) return Math.round(kg * 1000);
    }
    const gMatch = variant.label.match(/(\d+)\s*g/i);
    if (gMatch) {
      const g = Number.parseInt(gMatch[1], 10);
      if (!Number.isNaN(g) && g > 0) return g;
    }
  }

  // Safe default: 500g per unit if unspecified
  return 500;
}

export type CartItemWeight = {
  variantId: string;
  quantity: number;
};

/**
 * Calculates total shipment weight directly from the database variants.
 */
export async function calculateCartWeightGrams(db: AnyDb, items: CartItemWeight[]): Promise<number> {
  if (items.length === 0) return 0;

  const variantIds = items.map((i) => i.variantId);
  const rows = await db
    .select({
      id: productVariants.id,
      weightGrams: productVariants.weightGrams,
      label: productVariants.label,
    })
    .from(productVariants)
    .where(inArray(productVariants.id, variantIds));

  const map = new Map(rows.map((r) => [r.id, extractVariantWeightGrams(r)]));

  let totalWeight = 0;
  for (const item of items) {
    const unitWeight = map.get(item.variantId) ?? 500;
    totalWeight += unitWeight * item.quantity;
  }

  return Math.max(100, totalWeight); // Minimum 100g
}

export type ShippingSiteSettings = {
  flatRatePaise?: number | null;
  freeShippingAbovePaise?: number | null;
  tamilNaduFlatRatePaise?: number | null;
  tamilNaduFreeShippingAbovePaise?: number | null;
};

/**
 * Checks whether an address or PIN code is within Tamil Nadu.
 * Checks canonical and common variations of state names, as well as postal PIN code ranges (60xxxx - 64xxxx).
 */
export function isTamilNadu(
  destination?: { state?: string | null; pincode?: string | null } | string | null,
  pincode?: string | null,
): boolean {
  if (!destination) return false;
  let stateStr: string | null = null;
  let pinStr: string | null = null;

  if (typeof destination === "string") {
    stateStr = destination;
    pinStr = pincode ?? null;
  } else {
    stateStr = destination.state ?? null;
    pinStr = destination.pincode ?? pincode ?? null;
  }

  if (stateStr) {
    const cleanState = stateStr.trim().toLowerCase();
    if (cleanState === "tamil nadu" || cleanState === "tamilnadu" || cleanState === "tn") {
      return true;
    }
    // If an explicit non-Tamil Nadu state is declared (e.g. Karnataka, Kerala, Delhi), it is not Tamil Nadu
    if (cleanState.length > 0 && cleanState !== "tamil nadu" && cleanState !== "tamilnadu" && cleanState !== "tn") {
      return false;
    }
  }

  // Fallback to 6-digit Indian PIN code check: Tamil Nadu postal circle ranges from 600001 to 643253 (prefix 60-64)
  if (pinStr) {
    const cleanPin = pinStr.trim().replace(/\s/g, "");
    if (/^6[0-4]\d{4}$/.test(cleanPin)) {
      return true;
    }
  }

  return false;
}

/**
 * Resolves the authoritative shipping rule function for order calculation.
 * Ensures the exact same rule applies during checkout order insertion as during quote calculation.
 */
export async function getAuthoritativeShippingRule(
  db: AnyDb,
  destination: { state?: string | null; pincode?: string | null },
): Promise<(subtotalPaise: number) => number> {
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, "shipping"));
  const v = (row?.value ?? {}) as ShippingSiteSettings;

  if (isTamilNadu(destination)) {
    const tnFlatRate =
      Number.isInteger(v.tamilNaduFlatRatePaise) && v.tamilNaduFlatRatePaise! >= 0
        ? v.tamilNaduFlatRatePaise!
        : (Number.isInteger(v.flatRatePaise) && v.flatRatePaise! >= 0 ? v.flatRatePaise! : 5000);

    const tnFreeAbove =
      Number.isInteger(v.tamilNaduFreeShippingAbovePaise) && v.tamilNaduFreeShippingAbovePaise! >= 0
        ? v.tamilNaduFreeShippingAbovePaise!
        : (Number.isInteger(v.freeShippingAbovePaise) ? v.freeShippingAbovePaise! : 50000);

    return (subtotalPaise: number) => {
      return subtotalPaise >= tnFreeAbove ? 0 : tnFlatRate;
    };
  }

  // Non-Tamil Nadu addresses: preserve configured general flat rate and threshold
  const generalFlatRate = Number.isInteger(v.flatRatePaise) && v.flatRatePaise! >= 0 ? v.flatRatePaise! : 0;
  const generalFreeAbove = Number.isInteger(v.freeShippingAbovePaise) ? v.freeShippingAbovePaise! : null;

  return (subtotalPaise: number) => {
    return generalFreeAbove !== null && subtotalPaise >= generalFreeAbove ? 0 : generalFlatRate;
  };
}

/**
 * Authoritatively calculates shipping charge and serviceability.
 *
 * Rules:
 * - Tamil Nadu orders:
 *   - Flat shipping charge of ₹50 (5000 paise).
 *   - Free shipping on qualifying subtotals >= ₹500 (50000 paise).
 *   - Subtotals < ₹500 (e.g. ₹499 = 49900 paise) incur ₹50 (5000 paise) shipping.
 * - Non-Tamil Nadu orders:
 *   - Serviceability check through shipping provider.
 *   - Live rates from provider if configured, or general flat rate configuration.
 *   - Tamil Nadu rates are not silently applied to other states.
 */
export async function calculateAuthoritativeShipping(
  db: AnyDb,
  destinationPincode: string,
  weightGrams: number,
  subtotalPaise: number,
  providerId?: string,
  destinationState?: string | null,
): Promise<ShippingRateQuote> {
  // 1. Fetch site shipping settings
  const [row] = await db.select().from(siteSettings).where(eq(siteSettings.key, "shipping"));
  const v = (row?.value ?? {}) as ShippingSiteSettings;

  // 2. Check provider serviceability
  const provider = getShippingProvider(providerId);
  const serviceability = await provider.checkServiceability(destinationPincode, weightGrams);

  if (!serviceability.serviceable) {
    return {
      serviceable: false,
      ratePaise: 0,
      message: serviceability.message || "Delivery is currently unavailable for this pincode.",
    };
  }

  // 3. Determine if destination is within Tamil Nadu
  const resolvedState = destinationState ?? serviceability.state ?? null;
  const inTamilNadu = isTamilNadu({ state: resolvedState, pincode: destinationPincode });

  if (inTamilNadu) {
    const tnFlatRate =
      Number.isInteger(v.tamilNaduFlatRatePaise) && v.tamilNaduFlatRatePaise! >= 0
        ? v.tamilNaduFlatRatePaise!
        : (Number.isInteger(v.flatRatePaise) && v.flatRatePaise! >= 0 ? v.flatRatePaise! : 5000);

    const tnFreeAbove =
      Number.isInteger(v.tamilNaduFreeShippingAbovePaise) && v.tamilNaduFreeShippingAbovePaise! >= 0
        ? v.tamilNaduFreeShippingAbovePaise!
        : (Number.isInteger(v.freeShippingAbovePaise) ? v.freeShippingAbovePaise! : 50000);

    const isFree = subtotalPaise >= tnFreeAbove;
    const ratePaise = isFree ? 0 : tnFlatRate;

    return {
      serviceable: true,
      ratePaise,
      courierName: serviceability.courierName,
      estimatedDays: serviceability.estimatedDays,
      freeShipping: isFree || ratePaise === 0,
    };
  }

  // 4. Non-Tamil Nadu: Live provider rate calculation if configured
  if (provider.isConfigured() && provider.id !== "manual") {
    try {
      const quote = await provider.calculateRate(destinationPincode, weightGrams, subtotalPaise);
      if (quote.serviceable && quote.ratePaise >= 0) {
        return quote;
      }
    } catch {
      // Fall through to configured general flat rate
    }
  }

  // 5. General non-Tamil Nadu business flat rate fallback
  const generalFlatRate = Number.isInteger(v.flatRatePaise) && v.flatRatePaise! >= 0 ? v.flatRatePaise! : 0;
  const generalFreeAbove = Number.isInteger(v.freeShippingAbovePaise) ? v.freeShippingAbovePaise! : null;
  const isFreeGeneral = generalFreeAbove !== null && subtotalPaise >= generalFreeAbove;
  const generalRate = isFreeGeneral ? 0 : generalFlatRate;

  return {
    serviceable: true,
    ratePaise: generalRate,
    courierName: serviceability.courierName,
    estimatedDays: serviceability.estimatedDays,
    freeShipping: isFreeGeneral || generalRate === 0,
  };
}

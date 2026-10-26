import { cache } from "react";
import { eq } from "drizzle-orm";
import { siteSettings } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { diff, writeAudit } from "../admin/audit";
import {
  type BusinessSettings,
  DEFAULT_BUSINESS_SETTINGS,
} from "./types";
import {
  type UpdateBusinessSettingsInput,
  updateBusinessSettingsSchema,
} from "./validation";

const SETTINGS_KEY = "business";

/**
 * Fetches the current business information and settings.
 * Returns default SPN Health Mix configuration if not explicitly set.
 */
export async function getBusinessSettings(db: AnyDb): Promise<BusinessSettings> {
  const [row] = await db
    .select()
    .from(siteSettings)
    .where(eq(siteSettings.key, SETTINGS_KEY))
    .limit(1);

  if (!row || !row.value || typeof row.value !== "object") {
    // Check if legacy "contact" key exists in site_settings
    const [legacyContact] = await db
      .select()
      .from(siteSettings)
      .where(eq(siteSettings.key, "contact"))
      .limit(1);

    if (legacyContact && legacyContact.value && typeof legacyContact.value === "object") {
      const c = legacyContact.value as Record<string, any>;
      return {
        ...DEFAULT_BUSINESS_SETTINGS,
        supportEmail: c.email || DEFAULT_BUSINESS_SETTINGS.supportEmail,
        phone: c.phone || null,
        whatsapp: c.whatsapp || null,
      };
    }

    return { ...DEFAULT_BUSINESS_SETTINGS };
  }

  const v = row.value as Record<string, any>;
  const rawBusinessName =
    typeof v.businessName === "string" && v.businessName.trim()
      ? v.businessName.trim()
      : DEFAULT_BUSINESS_SETTINGS.businessName;
  const businessName =
    rawBusinessName === "SPN Foods" ? "SPN Health Mix" : rawBusinessName;

  return {
    businessName,
    supportEmail: typeof v.supportEmail === "string" && v.supportEmail.trim() ? v.supportEmail.trim() : DEFAULT_BUSINESS_SETTINGS.supportEmail,
    phone: typeof v.phone === "string" && v.phone.trim() ? v.phone.trim() : null,
    whatsapp: typeof v.whatsapp === "string" && v.whatsapp.trim() ? v.whatsapp.trim() : null,
    address: v.address && typeof v.address === "object" ? {
      line1: v.address.line1?.trim() || null,
      line2: v.address.line2?.trim() || null,
      city: v.address.city?.trim() || null,
      state: v.address.state?.trim() || null,
      pincode: v.address.pincode?.trim() || null,
    } : null,
    fssaiNumber: typeof v.fssaiNumber === "string" && v.fssaiNumber.trim() ? v.fssaiNumber.trim() : DEFAULT_BUSINESS_SETTINGS.fssaiNumber,
    gstin: typeof v.gstin === "string" && v.gstin.trim() ? v.gstin.trim() : DEFAULT_BUSINESS_SETTINGS.gstin,
    socialLinks: v.socialLinks && typeof v.socialLinks === "object" ? {
      instagram: v.socialLinks.instagram?.trim() || null,
      facebook: v.socialLinks.facebook?.trim() || null,
      youtube: v.socialLinks.youtube?.trim() || null,
      twitter: v.socialLinks.twitter?.trim() || null,
    } : null,
    footerText: typeof v.footerText === "string" && v.footerText.trim() ? v.footerText.trim() : null,
    updatedAt: row.updatedAt ? row.updatedAt.toISOString() : null,
  };
}

/**
 * Updates business settings and records an audit log entry.
 * Admin authorization is enforced by the caller.
 */
export async function updateBusinessSettings(
  db: AnyDb,
  adminId: string,
  rawInput: UpdateBusinessSettingsInput,
): Promise<BusinessSettings> {
  const validated = updateBusinessSettingsSchema.parse(rawInput);
  const current = await getBusinessSettings(db);

  const updated: BusinessSettings = {
    businessName: validated.businessName !== undefined ? validated.businessName : current.businessName,
    supportEmail: validated.supportEmail !== undefined ? validated.supportEmail : current.supportEmail,
    phone: validated.phone !== undefined ? validated.phone : current.phone,
    whatsapp: validated.whatsapp !== undefined ? validated.whatsapp : current.whatsapp,
    address: validated.address !== undefined ? validated.address : current.address,
    fssaiNumber: validated.fssaiNumber !== undefined ? validated.fssaiNumber : current.fssaiNumber,
    gstin: validated.gstin !== undefined ? validated.gstin : current.gstin,
    socialLinks: validated.socialLinks !== undefined ? validated.socialLinks : current.socialLinks,
    footerText: validated.footerText !== undefined ? validated.footerText : current.footerText,
  };

  const now = new Date();

  await db
    .insert(siteSettings)
    .values({
      key: SETTINGS_KEY,
      value: updated,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: updated,
        updatedAt: now,
      },
    });

  // Also sync legacy "contact" key so any older readers remain compatible
  await db
    .insert(siteSettings)
    .values({
      key: "contact",
      value: {
        email: updated.supportEmail,
        phone: updated.phone,
        whatsapp: updated.whatsapp,
      },
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: siteSettings.key,
      set: {
        value: {
          email: updated.supportEmail,
          phone: updated.phone,
          whatsapp: updated.whatsapp,
        },
        updatedAt: now,
      },
    });

  const changes = diff(current as unknown as Record<string, unknown>, updated as unknown as Record<string, unknown>);

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "business_settings.updated",
    entityType: "site_settings",
    entityId: SETTINGS_KEY,
    details: changes,
  });

  return {
    ...updated,
    updatedAt: now.toISOString(),
  };
}

/**
 * Server-component friendly helper that safely fetches business settings.
 * Uses stateless HTTP getDb() and React cache() for request-level memoization.
 */
export const fetchBusinessSettings = cache(async (): Promise<BusinessSettings> => {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return DEFAULT_BUSINESS_SETTINGS;
  const { getDb } = await import("../db");
  const db = getDb(databaseUrl);
  try {
    return await getBusinessSettings(db);
  } catch (err) {
    console.error("Failed to load business settings:", err);
    return DEFAULT_BUSINESS_SETTINGS;
  }
});


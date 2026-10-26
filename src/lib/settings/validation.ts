import { z } from "zod";

export const businessAddressSchema = z.object({
  line1: z.string().trim().max(255).nullable().optional(),
  line2: z.string().trim().max(255).nullable().optional(),
  city: z.string().trim().max(100).nullable().optional(),
  state: z.string().trim().max(100).nullable().optional(),
  pincode: z.string().trim().max(10).nullable().optional(),
});

export const socialLinksSchema = z.object({
  instagram: z.string().trim().max(255).nullable().optional(),
  facebook: z.string().trim().max(255).nullable().optional(),
  youtube: z.string().trim().max(255).nullable().optional(),
  twitter: z.string().trim().max(255).nullable().optional(),
});

export const updateBusinessSettingsSchema = z.object({
  businessName: z.string().trim().min(1).max(100).optional(),
  supportEmail: z.string().trim().email().optional(),
  phone: z.string().trim().max(20).nullable().optional(),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  address: businessAddressSchema.nullable().optional(),
  fssaiNumber: z.string().trim().max(30).nullable().optional(),
  gstin: z.string().trim().max(30).nullable().optional(),
  socialLinks: socialLinksSchema.nullable().optional(),
  footerText: z.string().trim().max(255).nullable().optional(),
});

export type UpdateBusinessSettingsInput = z.infer<typeof updateBusinessSettingsSchema>;

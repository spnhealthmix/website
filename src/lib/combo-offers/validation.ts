import { z } from "zod";
import { text } from "../customers/validation";

/**
 * Validates a safe destination URL.
 * Accepts:
 *   - Internal paths starting with '/' (e.g. '/combo-offers', '/products/family-combo-offer')
 *     Strictly excludes protocol-relative slashes '//' and backslashes '\\'.
 *   - External URLs with 'http:' or 'https:' protocols.
 * Rejects:
 *   - 'javascript:', 'data:', 'vbscript:', 'file:', etc.
 */
export const destinationUrlSchema = z
  .string()
  .trim()
  .min(1, "Destination page is required.")
  .max(500, "Destination page cannot exceed 500 characters.")
  .refine(
    (url) => {
      if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
        return true;
      }
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Destination page must be a valid path (e.g. /combo-offers) or https:// URL." },
  );

/**
 * Validates an image URL/reference.
 * Accepts internal paths starting with '/' or valid 'http(s)://' URLs.
 */
export const imageUrlSchema = z
  .string()
  .trim()
  .min(1, "Poster image is required.")
  .max(1000, "Image URL is too long.")
  .refine(
    (url) => {
      if (url.startsWith("/") && !url.startsWith("//") && !url.includes("\\")) {
        return true;
      }
      try {
        const parsed = new URL(url);
        return parsed.protocol === "http:" || parsed.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Image must be a valid URL or path." },
  );

export const comboOfferCreateSchema = z
  .object({
    name: text(1, 150),
    desktopImageUrl: imageUrlSchema,
    mobileImageUrl: imageUrlSchema,
    destinationUrl: destinationUrlSchema.default("/combo-offers"),
    displayOrder: z.number().int().min(0, "Display order must be 0 or greater.").max(100_000).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export const comboOfferUpdateSchema = z
  .object({
    name: text(1, 150),
    desktopImageUrl: imageUrlSchema,
    mobileImageUrl: imageUrlSchema,
    destinationUrl: destinationUrlSchema,
    displayOrder: z.number().int().min(0, "Display order must be 0 or greater.").max(100_000),
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.");

export type ComboOfferCreateInput = z.infer<typeof comboOfferCreateSchema>;
export type ComboOfferUpdateInput = z.infer<typeof comboOfferUpdateSchema>;

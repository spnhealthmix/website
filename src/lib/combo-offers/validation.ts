import { z } from "zod";
import { text } from "../customers/validation";
import { SLUG_RE, slugify } from "../admin/slug";

/**
 * Validates a safe destination URL.
 * Accepts:
 *   - Internal paths starting with '/' (e.g. '/combo-offers', '/combo-offers/family-combo-offer')
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
  .min(1, "Image is required.")
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

export const optionalImageUrlSchema = z
  .string()
  .trim()
  .max(1000, "Image URL is too long.")
  .refine(
    (url) => {
      if (!url) return true;
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
  )
  .optional()
  .nullable();

export const slugSchema = z
  .string()
  .trim()
  .min(1, "Slug cannot be empty.")
  .max(120, "Slug cannot exceed 120 characters.")
  .regex(SLUG_RE, "Slug can only contain lowercase letters, numbers, and single hyphens.");

export const includedItemSchema = z.object({
  id: z.string().uuid().optional(),
  productId: z.string().uuid().optional().nullable(),
  productVariantId: z.string().uuid().optional().nullable(),
  itemTitle: z.string().trim().min(1, "Item title is required.").max(200, "Item title cannot exceed 200 characters."),
  quantity: z.number().int().min(1, "Quantity must be at least 1.").default(1),
  unit: z.string().trim().max(100).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
});

export const comboOfferCreateSchema = z
  .object({
    name: text(1, 150),
    slug: z.string().trim().max(120).optional(),
    shortDescription: z.string().trim().max(500).optional().nullable(),
    description: z.string().trim().max(5000).optional().nullable(),
    offerBadge: z.string().trim().max(50).optional().nullable(),
    packageLabel: z.string().trim().max(100).optional().nullable(),
    categoryId: z.string().uuid().optional().nullable(),
    imageUrl: optionalImageUrlSchema,
    desktopImageUrl: imageUrlSchema,
    mobileImageUrl: imageUrlSchema,
    destinationUrl: destinationUrlSchema.default("/combo-offers"),
    pricePaise: z.number().int().min(0, "Price must be 0 or greater.").default(0),
    mrpPaise: z.number().int().min(0, "Original price / MRP must be 0 or greater.").optional().nullable(),
    stock: z.number().int().min(0, "Stock must be 0 or greater.").default(50),
    allowAddToCart: z.boolean().default(true),
    packageHighlights: z.array(z.string().trim().min(1).max(200)).default([]),
    variantId: z.string().uuid().optional().nullable(),
    displayOrder: z.number().int().min(0, "Display order must be 0 or greater.").max(100_000).default(0),
    isActive: z.boolean().default(true),
    includedItems: z.array(includedItemSchema).default([]),
  })
  .refine(
    (data) => {
      if (data.mrpPaise != null && data.mrpPaise > 0) {
        return data.pricePaise <= data.mrpPaise;
      }
      return true;
    },
    {
      message: "Selling price cannot exceed the original price / MRP.",
      path: ["pricePaise"],
    },
  );

export const comboOfferUpdateSchema = z
  .object({
    name: text(1, 150),
    slug: slugSchema,
    shortDescription: z.string().trim().max(500).nullable(),
    description: z.string().trim().max(5000).nullable(),
    offerBadge: z.string().trim().max(50).nullable(),
    packageLabel: z.string().trim().max(100).nullable(),
    categoryId: z.string().uuid().nullable(),
    imageUrl: optionalImageUrlSchema,
    desktopImageUrl: imageUrlSchema,
    mobileImageUrl: imageUrlSchema,
    destinationUrl: destinationUrlSchema,
    pricePaise: z.number().int().min(0, "Price must be 0 or greater."),
    mrpPaise: z.number().int().min(0, "Original price / MRP must be 0 or greater.").nullable(),
    stock: z.number().int().min(0, "Stock must be 0 or greater."),
    allowAddToCart: z.boolean(),
    packageHighlights: z.array(z.string().trim().min(1).max(200)),
    variantId: z.string().uuid().nullable(),
    displayOrder: z.number().int().min(0, "Display order must be 0 or greater.").max(100_000),
    isActive: z.boolean(),
    includedItems: z.array(includedItemSchema),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update.")
  .refine(
    (data) => {
      if (data.pricePaise !== undefined && data.mrpPaise !== undefined && data.mrpPaise !== null && data.mrpPaise > 0) {
        return data.pricePaise <= data.mrpPaise;
      }
      return true;
    },
    {
      message: "Selling price cannot exceed the original price / MRP.",
      path: ["pricePaise"],
    },
  );

export type ComboOfferCreateInput = z.input<typeof comboOfferCreateSchema>;
export type ComboOfferUpdateInput = z.input<typeof comboOfferUpdateSchema>;
export type IncludedItemInput = z.input<typeof includedItemSchema>;

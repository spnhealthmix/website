import { z } from "zod";
import { optionalText, text } from "../customers/validation";
import { SLUG_RE } from "./slug";

/** Multi-line text (descriptions): keep line breaks, strip control characters, cap blank lines. */
const longText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) =>
      v == null
        ? null
        : v.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\n{3,}/g, "\n\n").trim(),
    )
    .pipe(z.string().max(max, `At most ${max} characters`).nullable())
    .transform((v) => (v === "" ? null : v));

export const slugSchema = z
  .string()
  .transform((v) => v.trim().toLowerCase())
  .pipe(z.string().min(2).max(80).regex(SLUG_RE, "Use lowercase letters, digits and single hyphens"));

const paise = z.number().int().min(1).max(10_000_000);
const sortOrder = z.number().int().min(0).max(100_000);

/* ------------------------------- Catalogue -------------------------------- */
// imageKey is deliberately NOT accepted anywhere: images only enter through the upload endpoints.

export const categoryCreateSchema = z
  .object({
    name: text(2, 80),
    slug: slugSchema.optional(),
    description: optionalText(500),
    sortOrder: sortOrder.optional(),
    isActive: z.boolean().optional(),
  })
  .strict();

export const categoryUpdateSchema = z
  .object({ name: text(2, 80), slug: slugSchema, description: optionalText(500), sortOrder, isActive: z.boolean() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

const productFields = {
  name: text(2, 120),
  shortDescription: optionalText(200),
  description: longText(5000),
  ingredients: longText(1500),
  usage: longText(1500),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  sortOrder,
};

export const productCreateSchema = z
  .object({
    categoryId: z.string().uuid(),
    slug: slugSchema.optional(),
    name: productFields.name,
    shortDescription: productFields.shortDescription.optional(),
    description: productFields.description.optional(),
    ingredients: productFields.ingredients.optional(),
    usage: productFields.usage.optional(),
    isActive: productFields.isActive.optional(),
    isFeatured: productFields.isFeatured.optional(),
    sortOrder: productFields.sortOrder.optional(),
  })
  .strict();

export const productUpdateSchema = z
  .object({ categoryId: z.string().uuid(), slug: slugSchema, ...productFields })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

const sku = z
  .string()
  .transform((v) => v.trim().toUpperCase())
  .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9._-]{1,39}$/, "SKU: 2-40 characters, letters, digits, . _ -"));

export const variantCreateSchema = z
  .object({
    sku,
    label: text(1, 40),
    weightGrams: z.number().int().min(1).max(100_000).nullish(),
    mrpPaise: paise,
    pricePaise: paise,
    stock: z.number().int().min(0).max(1_000_000).default(0),
    isActive: z.boolean().optional(),
  })
  .strict();

export const variantUpdateSchema = z
  .object({
    sku,
    label: text(1, 40),
    weightGrams: z.number().int().min(1).max(100_000).nullable(),
    mrpPaise: paise,
    pricePaise: paise,
    stock: z.number().int().min(0).max(1_000_000), // stocktake: set to an exact count
    stockDelta: z.number().int().min(-1_000_000).max(1_000_000), // goods received / written off
    isActive: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update")
  .refine((v) => !(v.stock !== undefined && v.stockDelta !== undefined), "Send either stock or stockDelta, not both")
  .refine((v) => v.stockDelta !== 0, "stockDelta must not be zero");

export const imageUpdateSchema = z
  .object({ alt: optionalText(150), sortOrder, isPrimary: z.literal(true) })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

/* --------------------------------- Orders --------------------------------- */

export const ORDER_STATUSES = [
  "pending_payment", "confirmed", "processing", "packed", "shipped", "delivered", "cancelled", "refunded",
] as const;

const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .url()
  .refine((u) => u.toLowerCase().startsWith("https://"), "Tracking link must start with https://");

export const shipmentInputSchema = z
  .object({
    courierName: text(2, 60),
    awb: z.string().transform((v) => v.trim()).pipe(z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 ._/-]{2,59}$/, "Tracking number looks invalid")),
    trackingUrl: httpsUrl.nullish(),
  })
  .strict();

export const shipmentCreateSchema = z
  .object({
    providerId: text(2, 40).optional(),
    courierName: text(2, 60).optional(),
    awb: shipmentInputSchema.shape.awb.optional(),
    trackingUrl: httpsUrl.nullish(),
  })
  .strict();

export const orderStatusSchema = z
  .object({
    to: z.enum(["processing", "packed", "shipped", "delivered", "cancelled"]),
    note: optionalText(300),
    shipment: shipmentInputSchema.optional(),
  })
  .strict();


export const shipmentUpdateSchema = z
  .object({ courierName: text(2, 60), awb: shipmentInputSchema.shape.awb, trackingUrl: httpsUrl.nullable() })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const orderNoteSchema = z.object({ note: longText(1000) }).strict();

export const refundResolveSchema = z
  .object({ reference: text(3, 100), amountPaise: paise, note: optionalText(300) })
  .strict();

/* ------------------------------- List queries ------------------------------ */

const intParam = (def: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : Number(v)))
    .pipe(z.number().int().min(min).max(max));

const dateParam = (endExclusive: boolean) =>
  z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) {
        ctx.addIssue({ code: "custom", message: "Use an ISO date, e.g. 2026-10-01" });
        return undefined;
      }
      // A bare date as an upper bound means "through the end of that day".
      if (endExclusive && /^\d{4}-\d{2}-\d{2}$/.test(v)) d.setUTCDate(d.getUTCDate() + 1);
      return d;
    });

export const orderListQuery = z.object({
  status: z.enum(ORDER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
  from: dateParam(false),
  to: dateParam(true),
  attention: z.enum(["1", "true"]).optional(),
  limit: intParam(25, 1, 100),
  offset: intParam(0, 0, 100_000),
});

export const refundListQuery = z.object({
  state: z.enum(["open", "resolved"]).default("open"),
  limit: intParam(25, 1, 100),
  offset: intParam(0, 0, 100_000),
});

export const productListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  categoryId: z.string().uuid().optional(),
  active: z.enum(["true", "false"]).optional(),
  limit: intParam(25, 1, 100),
  offset: intParam(0, 0, 100_000),
});

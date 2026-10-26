import { z } from "zod";

/** Indian states and union territories, canonical spelling. */
export const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana",
  "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana",
  "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal",
  "Andaman and Nicobar Islands", "Chandigarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi",
  "Jammu and Kashmir", "Ladakh", "Lakshadweep", "Puducherry",
] as const;
const STATE_BY_LOWER = new Map(INDIAN_STATES.map((s) => [s.toLowerCase(), s]));

// Strip control characters and collapse whitespace so stored text is always one clean line.
export const clean = (s: string) => s.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
export const text = (min: number, max: number) =>
  z.string().transform(clean).pipe(z.string().min(min, `At least ${min} characters`).max(max, `At most ${max} characters`));
export const optionalText = (max: number) =>
  z
    .string()
    .nullish()
    .transform((v) => (v == null ? null : clean(v)))
    .pipe(z.string().max(max, `At most ${max} characters`).nullable())
    .transform((v) => (v === "" ? null : v));

/** "+91 98765 43210", "09876543210", "9876543210" -> "9876543210". Rejects anything else. */
export function normalizeIndianMobile(input: string): string | null {
  let d = input.replace(/[\s\-().]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("91") && d.length === 12) d = d.slice(2);
  else if (d.startsWith("0") && d.length === 11) d = d.slice(1);
  return /^[6-9][0-9]{9}$/.test(d) ? d : null;
}

export const phoneSchema = z
  .string()
  .transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) ctx.addIssue({ code: "custom", message: "Enter a valid 10-digit Indian mobile number" });
    return n ?? "";
  });

const stateSchema = z.string().transform((v, ctx) => {
  const canon = STATE_BY_LOWER.get(clean(v).toLowerCase());
  if (!canon) ctx.addIssue({ code: "custom", message: "Select a valid Indian state or union territory" });
  return canon ?? "";
});

const pincodeSchema = z
  .string()
  .transform((v) => v.replace(/\s/g, ""))
  .pipe(z.string().regex(/^[1-9][0-9]{5}$/, "Enter a valid 6-digit PIN code"));

export const addressFields = {
  label: optionalText(30),
  fullName: text(2, 80),
  phone: phoneSchema,
  line1: text(5, 120),
  line2: optionalText(120),
  landmark: optionalText(80),
  city: text(2, 60),
  state: stateSchema,
  pincode: pincodeSchema,
};

export const addressCreateSchema = z.object({ ...addressFields, isDefault: z.boolean().optional() }).strict();

/** PATCH: any subset of fields, at least one. isDefault may only be set to true (see addresses.ts). */
export const addressUpdateSchema = z
  .object({
    label: addressFields.label,
    fullName: addressFields.fullName,
    phone: addressFields.phone,
    line1: addressFields.line1,
    line2: addressFields.line2,
    landmark: addressFields.landmark,
    city: addressFields.city,
    state: addressFields.state,
    pincode: addressFields.pincode,
    isDefault: z.boolean(),
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const profileUpdateSchema = z
  .object({
    name: text(2, 80),
    phone: z.union([phoneSchema, z.null()]), // null clears the phone number
  })
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Provide at least one field to update");

export const uuidSchema = z.string().uuid();

export const checkoutSchema = z
  .object({
    addressId: z.string().uuid(),
    items: z
      .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(99) }).strict())
      .min(1, "Cart is empty")
      .max(50)
      .optional(),
    expectedSubtotalPaise: z.number().int().nonnegative().optional(),
    couponCode: z.string().trim().min(1).max(50).optional(),
    note: optionalText(500).optional(),
  })
  .strict();

export const callbackSchema = z
  .object({
    razorpay_order_id: z.string().min(1).max(100),
    razorpay_payment_id: z.string().min(1).max(100),
    razorpay_signature: z.string().min(1).max(200),
  })
  .strict();

export const idempotencyKeySchema = z.string().regex(/^[A-Za-z0-9_-]{8,100}$/);

export const cartAddSchema = z
  .object({
    variantId: uuidSchema,
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

export const cartSetSchema = z
  .object({
    quantity: z.number().int().min(1).max(99),
  })
  .strict();

export const shippingQuoteSchema = z
  .object({
    addressId: uuidSchema,
  })
  .strict();


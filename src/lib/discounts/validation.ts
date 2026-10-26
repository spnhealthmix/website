import { z } from "zod";

export const offerCreateSchema = z
  .object({
    name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
    scope: z.enum(["product", "category"]),
    productId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    discountType: z.enum(["percentage", "flat"]),
    value: z.number().int().positive("Discount value must be greater than 0"),
    startsAt: z.string().datetime("Start date must be an ISO timestamp"),
    endsAt: z.string().datetime("End date must be an ISO timestamp"),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) => {
      if (data.scope === "product") return !!data.productId && !data.categoryId;
      if (data.scope === "category") return !!data.categoryId && !data.productId;
      return false;
    },
    { message: "Scope 'product' requires productId; scope 'category' requires categoryId." },
  )
  .refine((data) => new Date(data.endsAt) > new Date(data.startsAt), {
    message: "End date must be strictly after start date.",
  })
  .refine(
    (data) => {
      if (data.discountType === "percentage") return data.value >= 1 && data.value <= 100;
      return data.value > 0;
    },
    { message: "Percentage discount must be between 1 and 100." },
  );

export const offerUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    scope: z.enum(["product", "category"]).optional(),
    productId: z.string().uuid().nullable().optional(),
    categoryId: z.string().uuid().nullable().optional(),
    discountType: z.enum(["percentage", "flat"]).optional(),
    value: z.number().int().positive().optional(),
    startsAt: z.string().datetime().optional(),
    endsAt: z.string().datetime().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt);
      }
      return true;
    },
    { message: "End date must be strictly after start date." },
  )
  .refine(
    (data) => {
      if (data.discountType === "percentage" && data.value !== undefined) {
        return data.value >= 1 && data.value <= 100;
      }
      return true;
    },
    { message: "Percentage discount must be between 1 and 100." },
  );

export const couponCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2, "Coupon code must be at least 2 characters")
      .max(50)
      .transform((c) => c.toUpperCase()),
    discountType: z.enum(["percentage", "flat"]),
    value: z.number().int().positive("Discount value must be greater than 0"),
    minOrderPaise: z.number().int().nonnegative().default(0),
    maxDiscountPaise: z.number().int().positive().nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt);
      }
      return true;
    },
    { message: "End date must be strictly after start date." },
  )
  .refine(
    (data) => {
      if (data.discountType === "percentage") return data.value >= 1 && data.value <= 100;
      return data.value > 0;
    },
    { message: "Percentage discount must be between 1 and 100." },
  );

export const couponUpdateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(50)
      .transform((c) => c.toUpperCase())
      .optional(),
    discountType: z.enum(["percentage", "flat"]).optional(),
    value: z.number().int().positive().optional(),
    minOrderPaise: z.number().int().nonnegative().optional(),
    maxDiscountPaise: z.number().int().positive().nullable().optional(),
    maxUses: z.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .strict()
  .refine(
    (data) => {
      if (data.startsAt && data.endsAt) {
        return new Date(data.endsAt) > new Date(data.startsAt);
      }
      return true;
    },
    { message: "End date must be strictly after start date." },
  )
  .refine(
    (data) => {
      if (data.discountType === "percentage" && data.value !== undefined) {
        return data.value >= 1 && data.value <= 100;
      }
      return true;
    },
    { message: "Percentage discount must be between 1 and 100." },
  );

export const cartCouponSchema = z
  .object({
    couponCode: z.string().trim().min(1, "Coupon code is required").max(50),
  })
  .strict();

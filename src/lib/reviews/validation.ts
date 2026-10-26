import { z } from "zod";
import { uuidSchema } from "../customers/validation";

export const reviewCreateSchema = z.object({
  rating: z
    .number({ required_error: "Rating is required." })
    .int("Rating must be an integer.")
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  title: z
    .string()
    .trim()
    .max(100, "Review title cannot exceed 100 characters.")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  body: z
    .string({ required_error: "Review body is required." })
    .trim()
    .min(3, "Review text must be at least 3 characters.")
    .max(2000, "Review text cannot exceed 2000 characters."),
});

export const reviewUpdateSchema = z.object({
  rating: z
    .number({ required_error: "Rating is required." })
    .int("Rating must be an integer.")
    .min(1, "Rating must be between 1 and 5.")
    .max(5, "Rating must be between 1 and 5."),
  title: z
    .string()
    .trim()
    .max(100, "Review title cannot exceed 100 characters.")
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  body: z
    .string({ required_error: "Review body is required." })
    .trim()
    .min(3, "Review text must be at least 3 characters.")
    .max(2000, "Review text cannot exceed 2000 characters."),
});

export const publicReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(10),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  sort: z.enum(["recent", "highest", "lowest"]).default("recent"),
});

export const adminReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["pending", "published", "hidden"]).optional(),
  productId: uuidSchema.optional(),
  rating: z.coerce.number().int().min(1).max(5).optional(),
  verifiedOnly: z
    .union([z.boolean(), z.string()])
    .optional()
    .transform((val) => (val === true || val === "true" ? true : undefined)),
  search: z.string().trim().optional(),
});

export const adminReviewStatusUpdateSchema = z.object({
  status: z.enum(["pending", "published", "hidden"]),
  adminNote: z.string().trim().max(500).optional().nullable(),
});

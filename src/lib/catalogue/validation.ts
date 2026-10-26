import { z } from "zod";
import { SLUG_RE } from "../admin/slug";
import { clean } from "../customers/validation";

const intParam = (def: number, min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? def : Number(v)))
    .pipe(z.number().int().min(min).max(max));

const optionalInt = (min: number, max: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(min).max(max).optional());

export const PRODUCT_SORTS = ["featured", "relevance", "price_asc", "price_desc", "newest", "name"] as const;
export const MAX_PAGE_SIZE = 48;

/** Search text: one clean line, 2-100 characters, at most 5 words are used. */
const searchText = z
  .string()
  .optional()
  .transform((v) => (v === undefined ? undefined : clean(v)))
  .pipe(z.string().min(2, "Type at least 2 characters").max(100).optional())
  .or(z.literal("").transform(() => undefined));

export const publicProductQuery = z
  .object({
    category: z.string().max(80).regex(SLUG_RE).optional(),
    q: searchText,
    sort: z.enum(PRODUCT_SORTS).optional(),
    minPrice: optionalInt(0, 10_000_000), // paise
    maxPrice: optionalInt(0, 10_000_000),
    inStock: z.literal("true").optional(),
    featured: z.literal("true").optional(),
    limit: intParam(12, 1, MAX_PAGE_SIZE),
    offset: intParam(0, 0, 100_000),
  })
  .refine((v) => v.minPrice === undefined || v.maxPrice === undefined || v.minPrice <= v.maxPrice, {
    message: "minPrice must not be above maxPrice",
    path: ["minPrice"],
  });

export type PublicProductQuery = z.infer<typeof publicProductQuery>;

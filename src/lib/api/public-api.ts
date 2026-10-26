import { eq } from "drizzle-orm";
import { products } from "../db/schema";
import { getPublicProduct, listPublicCategories, listPublicProducts } from "../catalogue/public";
import { publicProductQuery } from "../catalogue/validation";
import { SLUG_RE } from "../admin/slug";
import type { AnyDb } from "../orders/common";
import { publicReviewQuerySchema } from "../reviews/validation";
import { listProductReviews } from "../reviews/service";
import { ApiError, errorBody, json, toResponse, validate } from "./http";

/** Public endpoints need a database and an image base URL: no session, no payments, no storage. */
export type PublicDeps = {
  withDb: <T>(fn: (db: AnyDb) => Promise<T>) => Promise<T>;
  imageBaseUrl?: string;
  log?: (msg: string, extra?: unknown) => void;
};

/**
 * Browsers and the Cloudflare edge may reuse a response for 30 s and serve a stale one for a
 * further 60 s while refreshing. That is short enough that price and stock edits show up
 * almost immediately, and harmless even when briefly stale: the cart and checkout always read
 * the database themselves, so a cached price is only ever a display price.
 */
export const PUBLIC_CACHE = "public, max-age=30, s-maxage=30, stale-while-revalidate=60";

async function etagOf(body: string) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  return `W/"${Array.from(digest.subarray(0, 12), (b) => b.toString(16).padStart(2, "0")).join("")}"`;
}

/**
 * GET/HEAD only, no authentication, no cookies read. Successful responses are cacheable and
 * carry an ETag, so a returning visitor's browser gets a tiny 304 when nothing changed.
 * Errors are never cached.
 */
async function publicGet(deps: PublicDeps, req: Request, fn: (db: AnyDb) => Promise<unknown>): Promise<Response> {
  const log = deps.log ?? ((m, e) => console.error(m, e));
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      return json(405, errorBody("METHOD_NOT_ALLOWED", "Use GET."), { Allow: "GET, HEAD" });
    }
    const data = await deps.withDb(fn);
    const body = JSON.stringify(data);
    const etag = await etagOf(body);
    const headers = { "Cache-Control": PUBLIC_CACHE, ETag: etag, "Content-Type": "application/json", Vary: "Accept-Encoding" };

    const inm = req.headers.get("if-none-match");
    if (inm && inm.split(",").some((t) => t.trim() === etag || t.trim() === "*")) {
      return new Response(null, { status: 304, headers });
    }
    return new Response(req.method === "HEAD" ? null : body, { status: 200, headers });
  } catch (err) {
    return toResponse(err, log); // private, no-store
  }
}

const params = (req: Request) => Object.fromEntries(new URL(req.url).searchParams);

export const publicCategories = (req: Request, deps: PublicDeps) =>
  publicGet(deps, req, (db) => listPublicCategories(db, { imageBaseUrl: deps.imageBaseUrl }));

export const publicProducts = (req: Request, deps: PublicDeps) =>
  publicGet(deps, req, (db) => listPublicProducts(db, validate(publicProductQuery, params(req)), { imageBaseUrl: deps.imageBaseUrl }));

export const publicProduct = (req: Request, deps: PublicDeps, slug: string) =>
  publicGet(deps, req, async (db) => {
    if (!slug || slug.length > 80 || !SLUG_RE.test(slug)) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    return getPublicProduct(db, slug, { imageBaseUrl: deps.imageBaseUrl });
  });

export const publicProductReviews = (req: Request, deps: PublicDeps, slug: string) =>
  publicGet(deps, req, async (db) => {
    if (!slug || slug.length > 80 || !SLUG_RE.test(slug)) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    const [prod] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);
    if (!prod) throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");

    const query = validate(publicReviewQuerySchema, params(req));
    return listProductReviews(db, prod.id, query);
  });

export const publicBusinessInfo = (req: Request, deps: PublicDeps) =>
  publicGet(deps, req, async (db) => {
    const { getBusinessSettings } = await import("../settings/service");
    const s = await getBusinessSettings(db);
    return {
      businessName: s.businessName,
      supportEmail: s.supportEmail,
      phone: s.phone,
      whatsapp: s.whatsapp,
      address: s.address,
      fssaiNumber: s.fssaiNumber,
      gstin: s.gstin,
      socialLinks: s.socialLinks,
      footerText: s.footerText,
    };
  });


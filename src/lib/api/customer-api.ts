import { and, eq, gt, sql } from "drizzle-orm";
import { orders, payments, products, siteSettings } from "../db/schema";
import {
  createAddress, deleteAddress, getOwnedAddress, listAddresses, setDefaultAddress, toSnapshot, updateAddress,
} from "../customers/addresses";
import { addCartItem, clearCart, getCart, loadCartLines, removeCartItem, setCartItemQuantity, type CartView } from "../cart/cart";
import {
  type GuestCartItem,
  extractGuestCartFromRequest,
  serializeGuestCartCookie,
  serializeClearGuestCartCookie,
  getGuestCart,
  addGuestCartItem,
  setGuestCartItemQuantity,
  removeGuestCartItem,
  mergeGuestCartIntoUser,
} from "../cart/guest-cart";
import { CartError } from "../cart/errors";
import { getMyOrder, listMyOrders, verifyCheckoutCallback } from "../customers/orders";
import type { AuthedUser } from "../customers/profile";
import { getProfile, updateProfile } from "../customers/profile";
import {
  addressCreateSchema, addressUpdateSchema, callbackSchema, cartAddSchema, cartSetSchema, checkoutSchema, idempotencyKeySchema,
  profileUpdateSchema, shippingQuoteSchema, uuidSchema,
} from "../customers/validation";
import { calculateDiscounts, type DiscountItem } from "../discounts/engine";
import { cartCouponSchema } from "../discounts/validation";
import { CustomerError } from "../customers/errors";
import { OrderError, type AnyDb } from "../orders/common";
import { startCheckout } from "../orders/checkout";
import {
  calculateAuthoritativeShipping,
  calculateCartWeightGrams,
  getAuthoritativeShippingRule,
} from "../shipping/calculator";
import { getShippingProvider } from "../shipping/provider";
import type { PaymentGateway } from "../payments/razorpay";
import type { ObjectStorage } from "../storage/storage";
import { SLUG_RE } from "../admin/slug";
import { reviewCreateSchema, reviewUpdateSchema } from "../reviews/validation";
import {
  checkReviewEligibility, deleteOwnReview, listCustomerReviews, submitReview, updateOwnReview,
} from "../reviews/service";
import { ApiError, errorBody, isUniqueViolation, json, readJson, toResponse, validate } from "./http";
import { checkEndpointRateLimit } from "../security/rate-limit";
import { assertAdminOriginAllowed, assertCustomerOriginAllowed } from "../security/origin";


export type ApiDeps = {
  /** Opens a db connection for this request and always closes it afterwards. */
  withDb: <T>(fn: (db: AnyDb) => Promise<T>) => Promise<T>;
  /** Resolves the verified session to a local profile, or null when signed out. */
  authenticate: (req: Request, db: AnyDb) => Promise<AuthedUser | null>;
  gateway: PaymentGateway;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  /** e.g. ["https://spnhealthmix.in"]. If set, browser requests from any other Origin are refused. */
  allowedOrigins?: string[];
  now?: () => Date;
  log?: (msg: string, extra?: unknown) => void;
  storage?: ObjectStorage;
  imageBaseUrl?: string;
};

export type Ctx = { db: AnyDb; user: AuthedUser; req: Request };

export const MAX_OPEN_PENDING_ORDERS = 3;

/**
 * Every endpoint goes through here, so none can forget the basics:
 *   1. CSRF defence for state-changing calls: Origin must be an allowed site (when sent),
 *      and bodies must be application/json (plain cross-site <form> posts can't send that).
 *   2. Authentication from the verified database session, else 401.
 *   3. One place that converts errors into safe responses.
 */
export function secured(deps: ApiDeps, req: Request, opts: { mutating: boolean; requireOrigin?: boolean }, fn: (c: Ctx) => Promise<Response>) {
  const log = deps.log ?? ((m, e) => console.error(m, e));
  return (async () => {
    try {
      if (opts.requireOrigin) {
        assertAdminOriginAllowed(req, deps.allowedOrigins);
      } else if (opts.mutating) {
        assertCustomerOriginAllowed(req, deps.allowedOrigins);
      }
      return await deps.withDb(async (db) => {
        const user = await deps.authenticate(req, db);
        if (!user) return json(401, errorBody("UNAUTHENTICATED", "Please sign in."));
        return fn({ db, user, req });
      });
    } catch (err) {
      return toResponse(err, log);
    }
  })();
}

const notFound = (id: string | undefined, code: "ADDRESS_NOT_FOUND" | "ORDER_NOT_FOUND") => {
  // A malformed id can never match a row; answer exactly like a missing one.
  if (!id || !uuidSchema.safeParse(id).success) {
    throw new CustomerError(code, code === "ADDRESS_NOT_FOUND" ? "Address not found." : "Order not found.");
  }
  return id;
};

/* ------------------------------- Profile ---------------------------------- */

export const getMe = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) => json(200, await getProfile(db, user.profileId)));

export const patchMe = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    const patch = validate(profileUpdateSchema, await readJson(req));
    return json(200, await updateProfile(db, user.profileId, patch));
  });

/* ------------------------------- Addresses -------------------------------- */

export const getAddresses = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) =>
    json(200, { addresses: await listAddresses(db, user.profileId) }));

export const postAddress = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    const input = validate(addressCreateSchema, await readJson(req));
    return json(201, await createAddress(db, user.profileId, input));
  });

export const patchAddress = (req: Request, deps: ApiDeps, id: string) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    const patch = validate(addressUpdateSchema, await readJson(req));
    return json(200, await updateAddress(db, user.profileId, notFound(id, "ADDRESS_NOT_FOUND"), patch));
  });

export const removeAddress = (req: Request, deps: ApiDeps, id: string) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    await deleteAddress(db, user.profileId, notFound(id, "ADDRESS_NOT_FOUND"));
    return json(200, { deleted: true });
  });

export const postDefaultAddress = (req: Request, deps: ApiDeps, id: string) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) =>
    json(200, await setDefaultAddress(db, user.profileId, notFound(id, "ADDRESS_NOT_FOUND"))));

/* -------------------------------- Orders ---------------------------------- */

export const getOrders = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) => {
    const url = new URL(req.url);
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit")) || 20, 50));
    const offset = Math.max(0, Number(url.searchParams.get("offset")) || 0);
    return json(200, { orders: await listMyOrders(db, user.profileId, { limit, offset }) });
  });

export const getOrder = (req: Request, deps: ApiDeps, id: string) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) =>
    json(200, await getMyOrder(db, user.profileId, notFound(id, "ORDER_NOT_FOUND"))));

/* --------------------------------- Cart ----------------------------------- */

const variantFromPath = (id: string | undefined) => {
  if (!id || !uuidSchema.safeParse(id).success) throw new CartError("VARIANT_UNAVAILABLE", "This item is no longer available.");
  return id;
};

/**
 * Cart endpoints wrapper supporting both authenticated customer sessions and guest carts.
 * When an authenticated user has guest cart items in their cookie, they are safely merged
 * into the customer's database cart and the guest cookie is cleared.
 */
export function cartAction(
  deps: ApiDeps,
  req: Request,
  opts: { mutating: boolean },
  fn: (c: {
    db: AnyDb;
    user: AuthedUser | null;
    req: Request;
    guestItems: GuestCartItem[];
  }) => Promise<{ cart: CartView; newGuestItems?: GuestCartItem[] | null }>
) {
  const log = deps.log ?? ((m, e) => console.error(m, e));
  return (async () => {
    try {
      if (opts.mutating && deps.allowedOrigins) {
        const origin = req.headers.get("origin");
        if (origin && !deps.allowedOrigins.includes(origin)) {
          throw new ApiError(403, "FORBIDDEN_ORIGIN", "Request origin not allowed.");
        }
      }
      return await deps.withDb(async (db) => {
        const user = await deps.authenticate(req, db);
        const guestItems = extractGuestCartFromRequest(req);

        // If user is authenticated and there are guest items in cookie, merge them!
        if (user && guestItems.length > 0) {
          await mergeGuestCartIntoUser(db, user.profileId, guestItems);
          const mergedCart = await getCart(db, user.profileId);
          const res = json(200, mergedCart);
          res.headers.append("Set-Cookie", serializeClearGuestCartCookie());
          return res;
        }

        const result = await fn({ db, user, req, guestItems });
        const res = json(200, result.cart);
        if (result.newGuestItems !== undefined) {
          if (result.newGuestItems === null) {
            res.headers.append("Set-Cookie", serializeClearGuestCartCookie());
          } else {
            res.headers.append("Set-Cookie", serializeGuestCartCookie(result.newGuestItems));
          }
        }
        return res;
      });
    } catch (err) {
      return toResponse(err, log);
    }
  })();
}

export const getCartH = (req: Request, deps: ApiDeps) =>
  cartAction(deps, req, { mutating: false }, async ({ db, user, guestItems }) => {
    if (user) {
      return { cart: await getCart(db, user.profileId) };
    }
    return { cart: await getGuestCart(db, guestItems) };
  });

export const postCartItem = (req: Request, deps: ApiDeps) =>
  cartAction(deps, req, { mutating: true }, async ({ db, user, guestItems, req }) => {
    const b = validate(cartAddSchema, await readJson(req));
    if (user) {
      return { cart: await addCartItem(db, user.profileId, b.variantId, b.quantity) };
    }
    const { items: newGuestItems, cart } = await addGuestCartItem(db, guestItems, b.variantId, b.quantity);
    return { cart, newGuestItems };
  });

export const putCartItem = (req: Request, deps: ApiDeps, variantId: string) =>
  cartAction(deps, req, { mutating: true }, async ({ db, user, guestItems, req }) => {
    const b = validate(cartSetSchema, await readJson(req));
    const validVariantId = variantFromPath(variantId);
    if (user) {
      return { cart: await setCartItemQuantity(db, user.profileId, validVariantId, b.quantity) };
    }
    const { items: newGuestItems, cart } = await setGuestCartItemQuantity(db, guestItems, validVariantId, b.quantity);
    return { cart, newGuestItems };
  });

export const deleteCartItem = (req: Request, deps: ApiDeps, variantId: string) =>
  cartAction(deps, req, { mutating: true }, async ({ db, user, guestItems }) => {
    if (!uuidSchema.safeParse(variantId).success) {
      if (user) return { cart: await getCart(db, user.profileId) };
      return { cart: await getGuestCart(db, guestItems) };
    }
    if (user) {
      return { cart: await removeCartItem(db, user.profileId, variantId) };
    }
    const { items: newGuestItems, cart } = await removeGuestCartItem(db, guestItems, variantId);
    return { cart, newGuestItems };
  });

export const deleteCart = (req: Request, deps: ApiDeps) =>
  cartAction(deps, req, { mutating: true }, async ({ db, user }) => {
    if (user) {
      return { cart: await clearCart(db, user.profileId) };
    }
    return {
      cart: { items: [], summary: { lineCount: 0, totalQuantity: 0, subtotalPaise: 0, savingsPaise: 0, hasIssues: false, canCheckout: false } },
      newGuestItems: null,
    };
  });

/* ------------------------------- Checkout --------------------------------- */

async function shippingRule(
  db: AnyDb,
  address?: { state?: string | null; pincode?: string | null },
): Promise<(subtotalPaise: number) => number> {
  return getAuthoritativeShippingRule(db, address ?? {});
}

async function existingCheckout(db: AnyDb, profileId: string, key: string) {
  const [row] = await db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      amountPaise: orders.totalPaise,
      expiresAt: orders.expiresAt,
      status: orders.status,
      razorpayOrderId: payments.razorpayOrderId,
    })
    .from(orders)
    .leftJoin(payments, eq(payments.orderId, orders.id))
    .where(and(eq(orders.profileId, profileId), eq(orders.idempotencyKey, key)));
  return row ?? null;
}

/**
 * POST /api/checkout
 * Body: { addressId, note?, expectedSubtotalPaise? }   (no items: the server-side cart is used)
 * Header (recommended): Idempotency-Key: <random per checkout attempt>
 *
 * WHO the customer is comes only from the session. The body supplies an addressId, and
 * that address is loaded with `profile_id = me` in the query: another customer's id, a
 * deleted address and a made-up id all give the same 404. What is bought comes from the
 * customer's server-side cart; prices come from the database inside the order transaction,
 * so the cart view can never decide the charge.
 */
export const postCheckout = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    const body = validate(checkoutSchema, await readJson(req));

    const keyHeader = req.headers.get("idempotency-key");
    let idempotencyKey: string | undefined;
    if (keyHeader !== null) {
      if (!idempotencyKeySchema.safeParse(keyHeader).success) {
        throw new ApiError(422, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key must be 8-100 characters: letters, digits, _ or -.");
      }
      idempotencyKey = keyHeader;
    }

    const result = (r: { orderId: string; orderNumber: string; amountPaise: number; razorpayOrderId: string; expiresAt: Date | null }, replay: boolean) =>
      json(replay ? 200 : 201, {
        orderId: r.orderId,
        orderNumber: r.orderNumber,
        razorpayOrderId: r.razorpayOrderId,
        razorpayKeyId: deps.razorpayKeyId, // public by design
        amountPaise: r.amountPaise,
        currency: "INR",
        expiresAt: r.expiresAt,
        replayed: replay,
      });

    const replayOrConflict = async () => {
      const prev = idempotencyKey ? await existingCheckout(db, user.profileId, idempotencyKey) : null;
      if (!prev) return null;
      if (prev.razorpayOrderId && prev.status === "pending_payment") return result({ ...prev, razorpayOrderId: prev.razorpayOrderId }, true);
      if (prev.status !== "pending_payment") {
        throw new ApiError(409, "CHECKOUT_ALREADY_COMPLETED", "This checkout attempt is already finished. Start a new one.");
      }
      throw new ApiError(409, "CHECKOUT_IN_PROGRESS", "This checkout is still being set up. Retry in a moment.");
    };

    const replay = await replayOrConflict();
    if (replay) return replay;

    // What is being bought: explicit body items (for direct calls/tests) or the customer's server-side cart.
    const lines = (body.items && body.items.length > 0) ? body.items : await loadCartLines(db, user.profileId);
    if (lines.length === 0) throw new OrderError("EMPTY_CART", "Your cart is empty.");

    // Stop one account from tying up stock with piles of unpaid orders.
    const now = (deps.now ?? (() => new Date()))();
    const [{ open }] = await db
      .select({ open: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.profileId, user.profileId), eq(orders.status, "pending_payment"), gt(orders.expiresAt, now)));
    if (open >= MAX_OPEN_PENDING_ORDERS) {
      throw new ApiError(429, "TOO_MANY_PENDING_ORDERS", "You have unpaid orders waiting. Complete or wait for them to expire before starting another.");
    }

    const address = await getOwnedAddress(db, user.profileId, body.addressId); // 404 unless it's mine
    const weightGrams = await calculateCartWeightGrams(db, lines);
    const provider = getShippingProvider();
    const serviceability = await provider.checkServiceability(address.pincode, weightGrams);
    if (!serviceability.serviceable) {
      throw new ApiError(422, "UNSERVICEABLE_PINCODE", serviceability.message || "Delivery is currently unavailable for this pincode.");
    }
    const shipping = await shippingRule(db, address);

    try {
      const out = await startCheckout(db, deps.gateway, {
        profileId: user.profileId, // from the session, never from the body
        lines,
        expectedSubtotalPaise: body.expectedSubtotalPaise,
        shippingAddress: toSnapshot(address),
        shipping,
        customerNote: body.note ?? undefined,
        couponCode: body.couponCode,
        idempotencyKey,
        now,
      }, deps.log);
      return result(out, false);
    } catch (err) {
      // Two simultaneous requests with the same key: the loser's insert hit the unique index
      // (its stock changes rolled back with it). Answer from the winner's order.
      if (isUniqueViolation(err)) {
        const replay2 = await replayOrConflict();
        if (replay2) return replay2;
      }
      throw err;
    }
  });

/**
 * POST /api/checkout/verify   (called by the browser after Razorpay Checkout succeeds)
 * Verifies the signed callback and reports status. Never confirms payment itself.
 */
export const postCheckoutVerify = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    const b = validate(callbackSchema, await readJson(req));
    const out = await verifyCheckoutCallback(
      db,
      user.profileId,
      { razorpayOrderId: b.razorpay_order_id, razorpayPaymentId: b.razorpay_payment_id, signature: b.razorpay_signature },
      deps.razorpayKeySecret,
      { now: (deps.now ?? (() => new Date()))(), gateway: deps.gateway },
    );
    return json(200, { verified: true, ...out });
  });

/**
 * POST /api/cart/coupon
 * Body: { couponCode: string }
 *
 * Validates and previews coupon discount against the active customer's server-side cart.
 */
export const postCartCoupon = (req: Request, deps: ApiDeps) => {
  const log = deps.log ?? ((m, e) => console.error(m, e));
  return (async () => {
    try {
      return await deps.withDb(async (db) => {
        const rateLimit = await checkEndpointRateLimit(req, {
          endpoint: "cart_coupon",
          ipLimit: { limit: 15, windowSeconds: 300 },
          db,
          now: (deps.now ?? (() => new Date()))(),
        });

        if (!rateLimit.allowed) {
          if (rateLimit.reason === "limiter_unavailable") {
            throw new ApiError(
              503,
              "SERVICE_UNAVAILABLE",
              "Coupon validation is temporarily unavailable. Please try again shortly.",
              {},
              { "Retry-After": String(rateLimit.retryAfterSeconds) },
            );
          }
          throw new ApiError(
            429,
            "RATE_LIMITED",
            "Too many coupon attempts. Please try again later.",
            {},
            { "Retry-After": String(rateLimit.retryAfterSeconds) },
          );
        }

        const user = await deps.authenticate(req, db);
        const guestItems = extractGuestCartFromRequest(req);
        const body = validate(cartCouponSchema, await readJson(req));
        const cart = user ? await getCart(db, user.profileId) : await getGuestCart(db, guestItems);

        const discountItems: DiscountItem[] = cart.items
          .filter((i) => i.issue === null)
          .map((i) => ({
            variantId: i.variantId,
            productId: i.productId,
            quantity: i.quantity,
            unitPricePaise: i.unitPricePaise,
            lineTotalPaise: i.lineTotalPaise,
          }));

        const result = await calculateDiscounts(db, {
          items: discountItems,
          couponCode: body.couponCode,
          now: (deps.now ?? (() => new Date()))(),
        });

        return json(200, {
          valid: !result.couponError,
          error: result.couponError ?? null,
          subtotalPaise: result.subtotalPaise,
          offerDiscountPaise: result.offerDiscountPaise,
          couponDiscountPaise: result.couponDiscountPaise,
          totalDiscountPaise: result.totalDiscountPaise,
          finalPayablePaise: result.finalPayablePaise,
          appliedCoupon: result.appliedCoupon,
          appliedOffers: result.appliedOffers,
        });
      });
    } catch (err) {
      return toResponse(err, log);
    }
  })();
};

/**
 * POST /api/shipping/quote
 * Body: { addressId: string }
 *
 * Server-authoritatively calculates package weight from cart items and returns shipping rate & serviceability.
 */
export const postShippingQuote = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) => {
    const body = validate(shippingQuoteSchema, await readJson(req));
    const address = await getOwnedAddress(db, user.profileId, body.addressId);
    const cart = await getCart(db, user.profileId);
    if (cart.items.length === 0) {
      throw new OrderError("EMPTY_CART", "Your cart is empty.");
    }
    const weightGrams = await calculateCartWeightGrams(

      db,
      cart.items.map((it) => ({ variantId: it.variantId, quantity: it.quantity })),
    );
    const quote = await calculateAuthoritativeShipping(
      db,
      address.pincode,
      weightGrams,
      cart.summary.subtotalPaise,
      undefined,
      address.state,
    );
    return json(200, quote);
  });

/* --------------------------------- Reviews -------------------------------- */

/**
 * POST /api/catalogue/products/[slug]/reviews
 * Authenticated customer submits a review for product by slug.
 */
export const postProductReview = (req: Request, deps: ApiDeps, slug: string) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    if (!slug || slug.length > 80 || !SLUG_RE.test(slug)) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    const [prod] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);
    if (!prod) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    const body = validate(reviewCreateSchema, await readJson(req));
    const created = await submitReview(db, user.profileId, prod.id, body);
    return json(201, created);
  });

/**
 * GET /api/catalogue/products/[slug]/reviews/eligibility
 * Checks customer's eligibility to review product & returns existing review if any.
 */
export const getProductReviewEligibility = (req: Request, deps: ApiDeps, slug: string) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) => {
    if (!slug || slug.length > 80 || !SLUG_RE.test(slug)) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }
    const [prod] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.slug, slug))
      .limit(1);
    if (!prod) {
      throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
    }

    const eligibility = await checkReviewEligibility(db, user.profileId, prod.id);
    return json(200, eligibility);
  });

/**
 * GET /api/me/reviews
 * Lists all active reviews written by the authenticated customer.
 */
export const getMyReviews = (req: Request, deps: ApiDeps) =>
  secured(deps, req, { mutating: false }, async ({ db, user }) => {
    const list = await listCustomerReviews(db, user.profileId);
    return json(200, { reviews: list });
  });

/**
 * PATCH /api/me/reviews/[id]
 * Customer updates their own review.
 */
export const patchMyReview = (req: Request, deps: ApiDeps, reviewId: string) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    if (!reviewId || !uuidSchema.safeParse(reviewId).success) {
      throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
    }
    const body = validate(reviewUpdateSchema, await readJson(req));
    const updated = await updateOwnReview(db, user.profileId, reviewId, body);
    return json(200, updated);
  });

/**
 * DELETE /api/me/reviews/[id]
 * Customer deletes their own review.
 */
export const deleteMyReview = (req: Request, deps: ApiDeps, reviewId: string) =>
  secured(deps, req, { mutating: true }, async ({ db, user }) => {
    if (!reviewId || !uuidSchema.safeParse(reviewId).success) {
      throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
    }
    const res = await deleteOwnReview(db, user.profileId, reviewId);
    return json(200, res);
  });




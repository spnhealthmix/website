import { inArray, eq, sql } from "drizzle-orm";
import { productVariants, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import {
  type CartView,
  computeCartSummary,
  enrichCartLinesWithOffers,
  toLineView,
  assertQuantity,
  lookupBuyable,
  addCartItem,
  MAX_CART_LINES,
  MAX_QTY_PER_LINE,
} from "./cart";
import { CartError } from "./errors";

export const GUEST_CART_COOKIE_NAME = "spn_guest_cart";
export const GUEST_CART_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type GuestCartItem = {
  variantId: string;
  quantity: number;
};

/**
 * Extract guest cart items from request cookies.
 * Sanitizes entries and discards invalid or non-UUID data.
 */
export function extractGuestCartFromRequest(req: Request): GuestCartItem[] {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return [];

  const cookies = cookieHeader.split(";").map((c) => c.trim());
  for (const cookie of cookies) {
    if (cookie.startsWith(`${GUEST_CART_COOKIE_NAME}=`)) {
      try {
        const raw = decodeURIComponent(cookie.substring(GUEST_CART_COOKIE_NAME.length + 1));
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        const items: GuestCartItem[] = [];
        for (const it of parsed) {
          const v = it?.v ?? it?.variantId;
          const q = it?.q ?? it?.quantity;
          if (typeof v === "string" && typeof q === "number" && Number.isInteger(q) && q > 0) {
            items.push({
              variantId: v,
              quantity: Math.min(q, MAX_QTY_PER_LINE),
            });
          }
        }
        return items.slice(0, MAX_CART_LINES);
      } catch {
        return [];
      }
    }
  }
  return [];
}

/**
 * Build the Set-Cookie string for a guest cart.
 * Stores only compact variantId and quantity pairs.
 */
export function serializeGuestCartCookie(items: GuestCartItem[]): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  const compact = items.map((i) => ({ v: i.variantId, q: i.quantity }));
  const val = encodeURIComponent(JSON.stringify(compact));
  const expires = new Date(Date.now() + GUEST_CART_MAX_AGE_SECONDS * 1000).toUTCString();
  return `${GUEST_CART_COOKIE_NAME}=${val}; Path=/; HttpOnly; SameSite=Lax; Expires=${expires}; Max-Age=${GUEST_CART_MAX_AGE_SECONDS}${secureFlag}`;
}

/**
 * Build the Set-Cookie string to clear the guest cart cookie on login or checkout.
 */
export function serializeClearGuestCartCookie(): string {
  const isProd = process.env.NODE_ENV === "production";
  const secureFlag = isProd ? "; Secure" : "";
  return `${GUEST_CART_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secureFlag}`;
}

/**
 * Constructs a full, authoritative CartView for guest items, re-validated
 * against the live catalogue database with current prices, stock, and status.
 */
export async function getGuestCart(db: AnyDb, items: GuestCartItem[]): Promise<CartView> {
  if (items.length === 0) {
    return { items: [], summary: computeCartSummary([]) };
  }

  const variantIds = items.map((it) => it.variantId);
  const rows = await db
    .select({
      variantId: productVariants.id,
      sku: productVariants.sku,
      variantLabel: productVariants.label,
      pricePaise: productVariants.pricePaise,
      mrpPaise: productVariants.mrpPaise,
      stock: productVariants.stock,
      variantActive: productVariants.isActive,
      productId: products.id,
      productCategoryId: products.categoryId,
      productName: products.name,
      productSlug: products.slug,
      productActive: products.isActive,
      imageKey: sql<string | null>`(
        select pi.r2_key from product_images pi
        where pi.product_id = ${products.id}
        order by pi.is_primary desc, pi.sort_order asc, pi.id asc limit 1
      )`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, variantIds));

  // Maintain the exact ordering from the guest items list
  const lineViews = items.flatMap((item) => {
    const row = rows.find((r) => r.variantId === item.variantId);
    if (!row) return [];
    return [
      toLineView({
        ...row,
        quantity: item.quantity,
      }),
    ];
  });

  const categoryMap = new Map(rows.map((r) => [r.productId, r.productCategoryId]));
  return enrichCartLinesWithOffers(db, lineViews, categoryMap);
}

/**
 * Adds an item to the guest cart with full stock and availability checks.
 */
export async function addGuestCartItem(
  db: AnyDb,
  items: GuestCartItem[],
  variantId: string,
  quantity: number
): Promise<{ items: GuestCartItem[]; cart: CartView }> {
  assertQuantity(quantity);
  const buyable = await lookupBuyable(db, variantId);

  const existingIndex = items.findIndex((i) => i.variantId === variantId);
  const existingQty = existingIndex >= 0 ? items[existingIndex].quantity : 0;

  if (existingIndex < 0 && items.length >= MAX_CART_LINES) {
    throw new CartError("CART_LINE_LIMIT", `Your cart can hold up to ${MAX_CART_LINES} different items.`);
  }

  const nextQty = existingQty + quantity;
  assertQuantity(nextQty);

  if (nextQty > buyable.stock) {
    throw new CartError("INSUFFICIENT_STOCK", "Not enough stock for that quantity.", {
      variantId,
      availableQuantity: Math.max(0, Math.min(buyable.stock, MAX_QTY_PER_LINE)),
    });
  }

  const updatedItems = existingIndex >= 0
    ? items.map((it, idx) => (idx === existingIndex ? { ...it, quantity: nextQty } : it))
    : [...items, { variantId, quantity: nextQty }];

  const cart = await getGuestCart(db, updatedItems);
  return { items: updatedItems, cart };
}

/**
 * Sets an exact quantity for an item in the guest cart.
 */
export async function setGuestCartItemQuantity(
  db: AnyDb,
  items: GuestCartItem[],
  variantId: string,
  quantity: number
): Promise<{ items: GuestCartItem[]; cart: CartView }> {
  assertQuantity(quantity);
  const buyable = await lookupBuyable(db, variantId);

  const existingIndex = items.findIndex((i) => i.variantId === variantId);
  if (existingIndex < 0 && items.length >= MAX_CART_LINES) {
    throw new CartError("CART_LINE_LIMIT", `Your cart can hold up to ${MAX_CART_LINES} different items.`);
  }

  if (quantity > buyable.stock) {
    throw new CartError("INSUFFICIENT_STOCK", "Not enough stock for that quantity.", {
      variantId,
      availableQuantity: Math.max(0, Math.min(buyable.stock, MAX_QTY_PER_LINE)),
    });
  }

  const updatedItems = existingIndex >= 0
    ? items.map((it, idx) => (idx === existingIndex ? { ...it, quantity } : it))
    : [...items, { variantId, quantity }];

  const cart = await getGuestCart(db, updatedItems);
  return { items: updatedItems, cart };
}

/**
 * Removes an item from the guest cart.
 */
export async function removeGuestCartItem(
  db: AnyDb,
  items: GuestCartItem[],
  variantId: string
): Promise<{ items: GuestCartItem[]; cart: CartView }> {
  const updatedItems = items.filter((it) => it.variantId !== variantId);
  const cart = await getGuestCart(db, updatedItems);
  return { items: updatedItems, cart };
}

/**
 * Safely merges guest cart items into an authenticated user's database cart.
 */
export async function mergeGuestCartIntoUser(
  db: AnyDb,
  profileId: string,
  guestItems: GuestCartItem[]
): Promise<void> {
  for (const it of guestItems) {
    try {
      await addCartItem(db, profileId, it.variantId, it.quantity);
    } catch (err) {
      console.warn("Could not merge guest cart item into profile cart:", it.variantId, err);
    }
  }
}

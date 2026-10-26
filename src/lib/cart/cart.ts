import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { cartItems, carts, productVariants, products } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { CartError } from "./errors";

export const MAX_QTY_PER_LINE = 99;
export const MAX_CART_LINES = 50;

/* ------------------------------------------------------------------------- */
/* Reading                                                                    */
/* ------------------------------------------------------------------------- */

export type CartIssue = "UNAVAILABLE" | "OUT_OF_STOCK" | "INSUFFICIENT_STOCK" | null;

export type CartLineView = {
  variantId: string;
  productId: string;
  productName: string;
  productSlug: string;
  variantLabel: string;
  sku: string;
  imageKey: string | null;
  quantity: number;
  /** Live catalogue prices (paise), never stored in the cart. */
  unitPricePaise: number;
  mrpPaise: number;
  lineTotalPaise: number;
  /** null = can be checked out as it is. */
  issue: CartIssue;
  /** How many could be bought right now (capped at the per-line maximum). 0 if unavailable. */
  availableQuantity: number;
};

export type CartSummary = {
  lineCount: number;
  totalQuantity: number;
  /** Sum of lines with no issue. Items + current prices ONLY: no shipping, offers or coupons. */
  subtotalPaise: number;
  savingsPaise: number; // MRP minus price, same lines
  hasIssues: boolean;
  canCheckout: boolean;
};

export type CartView = { items: CartLineView[]; summary: CartSummary };

type RawLine = {
  variantId: string;
  quantity: number;
  sku: string;
  variantLabel: string;
  pricePaise: number;
  mrpPaise: number;
  stock: number;
  variantActive: boolean;
  productId: string;
  productName: string;
  productSlug: string;
  productActive: boolean;
  imageKey: string | null;
};

export function toLineView(r: RawLine): CartLineView {
  let issue: CartIssue = null;
  if (!r.variantActive || !r.productActive) issue = "UNAVAILABLE";
  else if (r.stock <= 0) issue = "OUT_OF_STOCK";
  else if (r.stock < r.quantity) issue = "INSUFFICIENT_STOCK";
  return {
    variantId: r.variantId,
    productId: r.productId,
    productName: r.productName,
    productSlug: r.productSlug,
    variantLabel: r.variantLabel,
    sku: r.sku,
    imageKey: r.imageKey,
    quantity: r.quantity,
    unitPricePaise: r.pricePaise,
    mrpPaise: r.mrpPaise,
    lineTotalPaise: r.pricePaise * r.quantity,
    issue,
    availableQuantity: issue === "UNAVAILABLE" ? 0 : Math.max(0, Math.min(r.stock, MAX_QTY_PER_LINE)),
  };
}

/**
 * The CART's total. Deliberately its own pure function: it knows nothing about shipping,
 * offers, coupons or payment, and checkout does not reuse it. The order recomputes its
 * numbers from the database inside its own transaction (see createPendingOrder), so the
 * cart can inform the customer but can never set what they are charged.
 */
export function computeCartSummary(items: CartLineView[]): CartSummary {
  const ok = items.filter((i) => i.issue === null);
  return {
    lineCount: items.length,
    totalQuantity: items.reduce((n, i) => n + i.quantity, 0),
    subtotalPaise: ok.reduce((n, i) => n + i.lineTotalPaise, 0),
    savingsPaise: ok.reduce((n, i) => n + Math.max(0, i.mrpPaise - i.unitPricePaise) * i.quantity, 0),
    hasIssues: items.some((i) => i.issue !== null),
    canCheckout: items.length > 0 && items.every((i) => i.issue === null),
  };
}

/**
 * Current cart, re-validated against the catalogue on every read. Never writes (viewing an
 * empty cart doesn't create one). Scoped by profile_id in the query: there is no cart id
 * anywhere in the API, so there is nothing for a customer to substitute.
 */
export async function getCart(db: AnyDb, profileId: string): Promise<CartView> {
  const rows = await db
    .select({
      variantId: cartItems.variantId,
      quantity: cartItems.quantity,
      sku: productVariants.sku,
      variantLabel: productVariants.label,
      pricePaise: productVariants.pricePaise,
      mrpPaise: productVariants.mrpPaise,
      stock: productVariants.stock,
      variantActive: productVariants.isActive,
      productId: products.id,
      productName: products.name,
      productSlug: products.slug,
      productActive: products.isActive,
      imageKey: sql<string | null>`(
        select pi.r2_key from product_images pi
        where pi.product_id = ${products.id}
        order by pi.is_primary desc, pi.sort_order asc, pi.id asc limit 1
      )`,
    })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .innerJoin(productVariants, eq(productVariants.id, cartItems.variantId))
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(carts.profileId, profileId))
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id));

  const items = rows.map(toLineView);
  return { items, summary: computeCartSummary(items) };
}

/** The (variant, quantity) pairs checkout will try to buy. Plain data, no prices. */
export async function loadCartLines(db: AnyDb, profileId: string) {
  const rows = await db
    .select({ variantId: cartItems.variantId, quantity: cartItems.quantity })
    .from(cartItems)
    .innerJoin(carts, eq(carts.id, cartItems.cartId))
    .where(eq(carts.profileId, profileId))
    .orderBy(asc(cartItems.createdAt), asc(cartItems.id));
  return rows;
}

/* ------------------------------------------------------------------------- */
/* Writing                                                                    */
/* ------------------------------------------------------------------------- */

export function assertQuantity(q: unknown): asserts q is number {
  if (typeof q !== "number" || !Number.isInteger(q) || q < 1) {
    throw new CartError("INVALID_QUANTITY", "Quantity must be a whole number of at least 1.");
  }
  if (q > MAX_QTY_PER_LINE) {
    throw new CartError("QUANTITY_LIMIT", `You can add at most ${MAX_QTY_PER_LINE} of one item.`);
  }
}

/**
 * Find-or-create the customer's cart and lock it. Every cart mutation runs under this
 * lock, which makes concurrent requests from the same customer (double-click, two tabs)
 * take effect one after another instead of overwriting each other's reads.
 * Two simultaneous first requests: the unique index on profile_id makes one INSERT a
 * no-op and both end up locking the same row.
 */
async function lockCart(tx: AnyDb, profileId: string): Promise<string> {
  await tx.insert(carts).values({ profileId }).onConflictDoNothing({ target: carts.profileId });
  const [c] = await tx.select({ id: carts.id }).from(carts).where(eq(carts.profileId, profileId)).for("update");
  return c.id;
}

/** Is this variant something a customer can buy right now? Also returns current stock. */
export async function lookupBuyable(tx: AnyDb, variantId: string) {
  const [v] = await tx
    .select({ stock: productVariants.stock, variantActive: productVariants.isActive, productActive: products.isActive })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(eq(productVariants.id, variantId));
  if (!v || !v.variantActive || !v.productActive) {
    throw new CartError("VARIANT_UNAVAILABLE", "This item is no longer available.");
  }
  return v;
}

async function writeQuantity(
  db: AnyDb,
  profileId: string,
  variantId: string,
  compute: (existing: number) => number,
) {
  await db.transaction(async (tx) => {
    const cartId = await lockCart(tx, profileId);
    const buyable = await lookupBuyable(tx, variantId);

    const lines = await tx.select({ variantId: cartItems.variantId, quantity: cartItems.quantity }).from(cartItems).where(eq(cartItems.cartId, cartId));
    const existing = lines.find((l) => l.variantId === variantId)?.quantity ?? 0;
    if (existing === 0 && lines.length >= MAX_CART_LINES) {
      throw new CartError("CART_LINE_LIMIT", `Your cart can hold up to ${MAX_CART_LINES} different items.`);
    }

    const next = compute(existing);
    assertQuantity(next);
    // Looked at, not reserved: stock is only taken at checkout.
    if (next > buyable.stock) {
      throw new CartError("INSUFFICIENT_STOCK", "Not enough stock for that quantity.", {
        variantId,
        availableQuantity: Math.max(0, Math.min(buyable.stock, MAX_QTY_PER_LINE)),
      });
    }

    await tx
      .insert(cartItems)
      .values({ cartId, variantId, quantity: next })
      .onConflictDoUpdate({ target: [cartItems.cartId, cartItems.variantId], set: { quantity: next, updatedAt: new Date() } });
    await tx.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cartId));
  });
}

/** Add `quantity` more of a variant. Adding one already in the cart merges into its line. */
export async function addCartItem(db: AnyDb, profileId: string, variantId: string, quantity: number) {
  assertQuantity(quantity);
  await writeQuantity(db, profileId, variantId, (existing) => existing + quantity);
  return getCart(db, profileId);
}

/**
 * Set a line to an exact quantity (creates the line if missing). Naturally idempotent:
 * repeating the same request, e.g. after a dropped connection, changes nothing more.
 */
export async function setCartItemQuantity(db: AnyDb, profileId: string, variantId: string, quantity: number) {
  assertQuantity(quantity);
  await writeQuantity(db, profileId, variantId, () => quantity);
  return getCart(db, profileId);
}

const myCartId = (db: AnyDb, profileId: string) => db.select({ id: carts.id }).from(carts).where(eq(carts.profileId, profileId));

/** Remove a line. Always allowed (even for unavailable items) and idempotent. */
export async function removeCartItem(db: AnyDb, profileId: string, variantId: string) {
  await db.delete(cartItems).where(and(eq(cartItems.variantId, variantId), inArray(cartItems.cartId, myCartId(db, profileId))));
  return getCart(db, profileId);
}

export async function clearCart(db: AnyDb, profileId: string) {
  await db.delete(cartItems).where(inArray(cartItems.cartId, myCartId(db, profileId)));
  return getCart(db, profileId);
}

/**
 * Called when an order is PAID: take the purchased quantities out of the customer's cart.
 * Until then the cart stays intact, so an abandoned or expired checkout loses nothing.
 * If the customer changed the cart after starting checkout, only what was bought is
 * removed (5 in cart, 2 bought -> 3 remain).
 */
export async function consumeCartForOrder(tx: AnyDb, profileId: string, lines: { variantId: string | null; quantity: number }[]) {
  for (const { variantId, quantity } of lines) {
    if (!variantId) continue;
    const mine = inArray(cartItems.cartId, myCartId(tx, profileId));
    await tx.delete(cartItems).where(and(eq(cartItems.variantId, variantId), mine, sql`${cartItems.quantity} <= ${quantity}`));
    await tx
      .update(cartItems)
      .set({ quantity: sql`${cartItems.quantity} - ${quantity}`, updatedAt: new Date() })
      .where(and(eq(cartItems.variantId, variantId), mine, sql`${cartItems.quantity} > ${quantity}`));
  }
}

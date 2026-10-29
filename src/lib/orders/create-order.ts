import { eq, inArray, sql } from "drizzle-orm";
import { orderCounters, orderItems, orders, productVariants, products, type AddressSnapshot } from "../db/schema";
import { calculateDiscounts } from "../discounts/engine";
import { OrderError, type AnyDb } from "./common";
import { decrementStock } from "./stock";

export const ORDER_TTL_MINUTES = 30;
export const MAX_QTY_PER_LINE = 99;

export type CartLine = { variantId: string; quantity: number };

export type CreateOrderInput = {
  profileId: string;
  lines: CartLine[];
  shippingAddress: AddressSnapshot;
  /**
   * Shipping fee in paise, or a function of the subtotal (for free-shipping thresholds).
   * Resolved inside the transaction from the prices actually charged. Defaults to 0.
   */
  shipping?: number | ((subtotalPaise: number) => number);
  customerNote?: string;
  couponCode?: string;
  /**
   * What the customer last SAW as the cart subtotal. Not trusted for pricing: it is only a
   * consistency check. If the real subtotal (from current database prices) differs, the whole
   * transaction rolls back with PRICE_CHANGED so nobody is charged a price they didn't see.
   */
  expectedSubtotalPaise?: number;
  /** Unique per (customer, key). A repeat insert fails with a unique violation and rolls everything back. */
  idempotencyKey?: string;
  /** Overridable for tests. */
  now?: Date;
  ttlMinutes?: number;
};

export type PendingOrder = {
  orderId: string;
  orderNumber: string;
  totalPaise: number;
  expiresAt: Date;
};

/**
 * Daily sequential order number generator (e.g. SPN-261029-0001).
 * Uses atomic upsert on order_counters table to ensure concurrency safety.
 */
async function generateOrderNumber(tx: AnyDb, now: Date): Promise<string> {
  const d = now.toISOString().slice(2, 10).replace(/-/g, ""); // YYMMDD

  // Ensure table exists (defensive fallback for fresh test / branch DBs)
  await tx.execute(sql`
    CREATE TABLE IF NOT EXISTS "order_counters" (
      "date" text PRIMARY KEY NOT NULL,
      "last_value" integer DEFAULT 0 NOT NULL,
      "created_at" timestamp with time zone DEFAULT now() NOT NULL,
      "updated_at" timestamp with time zone DEFAULT now() NOT NULL
    );
  `);

  const [row] = await tx
    .insert(orderCounters)
    .values({
      date: d,
      lastValue: 1,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: orderCounters.date,
      set: {
        lastValue: sql`${orderCounters.lastValue} + 1`,
        updatedAt: now,
      },
    })
    .returning({
      lastValue: orderCounters.lastValue,
    });

  let seqNum = row.lastValue;
  let orderNumber = `SPN-${d}-${String(seqNum).padStart(4, "0")}`;

  // Safety check to bypass any pre-existing collided order numbers
  while (true) {
    const existing = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(eq(orders.orderNumber, orderNumber))
      .limit(1);

    if (existing.length === 0) {
      break;
    }

    seqNum += 1;
    orderNumber = `SPN-${d}-${String(seqNum).padStart(4, "0")}`;
    await tx
      .update(orderCounters)
      .set({ lastValue: seqNum, updatedAt: now })
      .where(eq(orderCounters.date, d));
  }

  return orderNumber;
}

/**
 * Validate the cart, take the stock, and create the order + items in ONE transaction.
 * Any failure (including one line out of stock) rolls everything back, so a half-
 * reserved cart can never exist.
 *
 * Prices come from the database (never from the client). Offers/coupons are not
 * applied yet: discountPaise is 0.
 *
 * Razorpay is deliberately NOT called here. See startCheckout().
 */
export async function createPendingOrder(db: AnyDb, input: CreateOrderInput): Promise<PendingOrder> {
  if (input.lines.length === 0) throw new OrderError("EMPTY_CART", "Your cart is empty.");

  // Merge duplicate lines, validate quantities.
  const wanted = new Map<string, number>();
  for (const line of input.lines) {
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QTY_PER_LINE) {
      throw new OrderError("INVALID_QUANTITY", "Invalid quantity.", line.variantId);
    }
    wanted.set(line.variantId, (wanted.get(line.variantId) ?? 0) + line.quantity);
  }
  for (const [variantId, qty] of wanted) {
    if (qty > MAX_QTY_PER_LINE) throw new OrderError("INVALID_QUANTITY", "Invalid quantity.", variantId);
  }

  // Sorted so that two checkouts touching the same variants always lock rows in the
  // same order. Without this, A(v1,v2) and B(v2,v1) can deadlock.
  const variantIds = [...wanted.keys()].sort();

  const now = input.now ?? new Date();
  const expiresAt = new Date(now.getTime() + (input.ttlMinutes ?? ORDER_TTL_MINUTES) * 60_000);

  return db.transaction(async (tx) => {
    // Read-only validation + product names. Stock and price are taken from the
    // UPDATE ... RETURNING below, which is the authoritative moment.
    const found = await tx
      .select({
        variantId: productVariants.id,
        variantActive: productVariants.isActive,
        productName: products.name,
        productId: products.id,
        productActive: products.isActive,
      })
      .from(productVariants)
      .innerJoin(products, eq(products.id, productVariants.productId))
      .where(inArray(productVariants.id, variantIds));

    const byId = new Map(found.map((r) => [r.variantId, r]));
    for (const id of variantIds) {
      const row = byId.get(id);
      if (!row || !row.variantActive || !row.productActive) {
        throw new OrderError("VARIANT_UNAVAILABLE", "An item in your cart is no longer available.", id);
      }
    }

    let subtotal = 0;
    const lines: (typeof orderItems.$inferInsert)[] = [];

    for (const variantId of variantIds) {
      const qty = wanted.get(variantId)!;
      const taken = await decrementStock(tx, variantId, qty);
      if (!taken) {
        throw new OrderError("INSUFFICIENT_STOCK", "Not enough stock for an item in your cart.", variantId);
      }
      const lineTotal = taken.pricePaise * qty;
      subtotal += lineTotal;
      const meta = byId.get(variantId)!;
      lines.push({
        // orderId is filled in below
        orderId: "",
        productId: meta.productId,
        variantId,
        productName: meta.productName,
        variantLabel: taken.label,
        sku: taken.sku,
        unitPricePaise: taken.pricePaise,
        quantity: qty,
        lineTotalPaise: lineTotal,
      });
    }

    if (input.expectedSubtotalPaise !== undefined && input.expectedSubtotalPaise !== subtotal) {
      throw new OrderError("PRICE_CHANGED", "Prices in your cart have changed. Please review your cart.", undefined, undefined, {
        currentSubtotalPaise: subtotal,
      });
    }

    const shipping =
      typeof input.shipping === "function" ? input.shipping(subtotal) : (input.shipping ?? 0);
    if (!Number.isInteger(shipping) || shipping < 0) throw new Error("Invalid shipping amount");
    const orderNumber = await generateOrderNumber(tx, now);

    const discounts = await calculateDiscounts(tx, {
      items: lines.map((l) => ({
        variantId: l.variantId!,
        productId: l.productId!,
        quantity: l.quantity,
        unitPricePaise: l.unitPricePaise,
        lineTotalPaise: l.lineTotalPaise,
      })),
      couponCode: input.couponCode,
      now,
    });

    if (input.couponCode && discounts.couponError) {
      throw new OrderError("INVALID_COUPON", discounts.couponError);
    }

    const discountPaise = discounts.totalDiscountPaise;
    const couponId = discounts.appliedCoupon?.couponId ?? null;
    const couponCode = discounts.appliedCoupon?.code ?? null;
    const totalPaise = subtotal - discountPaise + shipping;

    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber,
        profileId: input.profileId,
        status: "pending_payment",
        subtotalPaise: subtotal,
        discountPaise,
        shippingPaise: shipping,
        totalPaise,
        couponId,
        couponCode,
        shippingAddress: input.shippingAddress,
        customerNote: input.customerNote,
        idempotencyKey: input.idempotencyKey,
        expiresAt,
      })
      .returning({ id: orders.id, totalPaise: orders.totalPaise });

    await tx.insert(orderItems).values(lines.map((l) => ({ ...l, orderId: order.id })));

    return { orderId: order.id, orderNumber, totalPaise: order.totalPaise, expiresAt };
  });
}

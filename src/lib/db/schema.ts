import { relations, sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/* -------------------------------------------------------------------------- */
/* Conventions                                                                */
/* - All money is stored as INTEGER PAISE (₹399 = 39900). No floats.          */
/* - Images are stored as R2 object keys, never URLs or blobs.                */
/* - Orders snapshot names/prices/address so later edits don't rewrite history*/
/* -------------------------------------------------------------------------- */

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ------------------------------- Enums ------------------------------------ */

export const userRole = pgEnum("user_role", ["customer", "admin"]);
export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);
export const paymentStatus = pgEnum("payment_status", [
  "created",
  "authorized",
  "captured",
  "failed",
  "refunded",
  "refund_required", // captured, but the order could not be fulfilled (e.g. late payment, no stock)
]);
export const shipmentStatus = pgEnum("shipment_status", [
  "created",
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "delivered",
  "failed",
  "returned",
]);
export const discountType = pgEnum("discount_type", ["percentage", "flat"]);
export const offerScope = pgEnum("offer_scope", ["product", "category"]);
export const reviewStatus = pgEnum("review_status", ["pending", "published", "hidden"]);

/* ----------------------------- Profiles & Auth ----------------------------- */
// Profiles represent registered customers and admins with application-managed authentication.
// Existing clerkUserId is preserved for historical account association.

export const profiles = pgTable(
  "profiles",
  {
    id: id(),
    clerkUserId: text("clerk_user_id"),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    emailVerifiedAt: timestamp("email_verified_at", { withTimezone: true }),
    name: text("name"),
    phone: text("phone"),
    role: userRole("role").notNull().default("customer"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("profiles_email_uq").on(sql`lower(${t.email})`),
    uniqueIndex("profiles_clerk_user_id_uq")
      .on(t.clerkUserId)
      .where(sql`${t.clerkUserId} IS NOT NULL`),
    check("profiles_phone_format", sql`${t.phone} IS NULL OR ${t.phone} ~ '^[6-9][0-9]{9}$'`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("sessions_token_hash_uq").on(t.tokenHash),
    index("sessions_profile_id_idx").on(t.profileId),
  ],
);

export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: id(),
    tokenHash: text("token_hash").notNull(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("password_reset_tokens_token_hash_uq").on(t.tokenHash),
    index("password_reset_tokens_profile_id_idx").on(t.profileId),
  ],
);

export const addresses = pgTable(
  "addresses",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label"),
    fullName: text("full_name").notNull(),
    phone: text("phone").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    landmark: text("landmark"),
    city: text("city").notNull(),
    state: text("state").notNull(),
    pincode: text("pincode").notNull(),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("addresses_profile_idx").on(t.profileId),
    uniqueIndex("addresses_one_default_uq").on(t.profileId).where(sql`${t.isDefault} = true`),
    check("addresses_phone_format", sql`${t.phone} ~ '^[6-9][0-9]{9}$'`),
    check("addresses_pincode_format", sql`${t.pincode} ~ '^[1-9][0-9]{5}$'`),
  ],
);

/* ----------------------------- Catalogue ---------------------------------- */

export const categories = pgTable(
  "categories",
  {
    id: id(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    imageKey: text("image_key"),
    sortOrder: integer("sort_order").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("categories_slug_uq").on(t.slug)],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "restrict" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    shortDescription: text("short_description"),
    description: text("description"),
    ingredients: text("ingredients"),
    usage: text("usage"),
    isActive: boolean("is_active").notNull().default(true),
    isFeatured: boolean("is_featured").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("products_slug_uq").on(t.slug),
    index("products_category_idx").on(t.categoryId),
    // simple Postgres full-text search for the storefront search box
    index("products_search_idx").using(
      "gin",
      sql`to_tsvector('simple', ${t.name} || ' ' || coalesce(${t.shortDescription}, ''))`,
    ),
  ],
);

export const productImages = pgTable(
  "product_images",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    r2Key: text("r2_key").notNull(), // e.g. products/karuppu-kavuni/main.webp
    alt: text("alt"),
    isPrimary: boolean("is_primary").notNull().default(false),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [
    index("product_images_product_idx").on(t.productId),
    uniqueIndex("product_images_one_primary_uq").on(t.productId).where(sql`"product_images"."is_primary"`),
  ],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    sku: text("sku").notNull(),
    label: text("label").notNull(), // "250 g", "500 g"
    weightGrams: integer("weight_grams"), // used for courier rate calculation
    mrpPaise: integer("mrp_paise").notNull(),
    pricePaise: integer("price_paise").notNull(), // selling price before offers
    stock: integer("stock").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("product_variants_sku_uq").on(t.sku),
    index("product_variants_product_idx").on(t.productId),
    check("variants_price_ok", sql`${t.pricePaise} >= 0 AND ${t.pricePaise} <= ${t.mrpPaise}`),
    check("variants_stock_ok", sql`${t.stock} >= 0`),
  ],
);

/* ------------------------- Offers & coupons ------------------------------- */

export const offers = pgTable(
  "offers",
  {
    id: id(),
    name: text("name").notNull(),
    scope: offerScope("scope").notNull(),
    productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "cascade" }),
    discountType: discountType("discount_type").notNull(),
    value: integer("value").notNull(), // percent (1-100) or paise
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [
    index("offers_active_window_idx").on(t.isActive, t.startsAt, t.endsAt),
    check(
      "offers_scope_target_ok",
      sql`(${t.scope} = 'product' AND ${t.productId} IS NOT NULL AND ${t.categoryId} IS NULL)
        OR (${t.scope} = 'category' AND ${t.categoryId} IS NOT NULL AND ${t.productId} IS NULL)`,
    ),
    check("offers_window_ok", sql`${t.endsAt} > ${t.startsAt}`),
    check(
      "offers_value_ok",
      sql`${t.value} > 0 AND (${t.discountType} <> 'percentage' OR ${t.value} <= 100)`,
    ),
  ],
);

export const coupons = pgTable(
  "coupons",
  {
    id: id(),
    code: text("code").notNull(), // store uppercase
    discountType: discountType("discount_type").notNull(),
    value: integer("value").notNull(),
    minOrderPaise: integer("min_order_paise").notNull().default(0),
    maxDiscountPaise: integer("max_discount_paise"), // cap for percentage coupons
    maxUses: integer("max_uses"),
    usedCount: integer("used_count").notNull().default(0),
    startsAt: timestamp("starts_at", { withTimezone: true }),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("coupons_code_uq").on(t.code)],
);

/* ------------------------------- Carts ------------------------------------ */

export const carts = pgTable(
  "carts",
  {
    id: id(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("carts_profile_uq").on(t.profileId)],
);

export const cartItems = pgTable(
  "cart_items",
  {
    id: id(),
    cartId: uuid("cart_id")
      .notNull()
      .references(() => carts.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id")
      .notNull()
      .references(() => productVariants.id, { onDelete: "cascade" }),
    quantity: integer("quantity").notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("cart_items_cart_variant_uq").on(t.cartId, t.variantId),
    check("cart_items_qty_ok", sql`${t.quantity} BETWEEN 1 AND 99`),
  ],
);

/* ------------------------------ Orders ------------------------------------ */

export type AddressSnapshot = {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
};

export const orders = pgTable(
  "orders",
  {
    id: id(),
    orderNumber: text("order_number").notNull(), // human-friendly, e.g. SPN-240001
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "restrict" }),
    status: orderStatus("status").notNull().default("pending_payment"),
    subtotalPaise: integer("subtotal_paise").notNull(),
    discountPaise: integer("discount_paise").notNull().default(0),
    shippingPaise: integer("shipping_paise").notNull().default(0),
    totalPaise: integer("total_paise").notNull(),
    couponId: uuid("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
    couponCode: text("coupon_code"),
    shippingAddress: jsonb("shipping_address").$type<AddressSnapshot>().notNull(),
    customerNote: text("customer_note"),
    adminNote: text("admin_note"),
    stockReleased: boolean("stock_released").notNull().default(false), // guard against double-restock on cancel
    // Pending orders hold stock until this time. The cron job cancels them after it passes.
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"), // "expired", "razorpay_order_failed", "customer", ...
    // Non-null means an admin must look at this order (late payment with no stock, amount mismatch...)
    attentionReason: text("attention_reason"),
    attentionAt: timestamp("attention_at", { withTimezone: true }),
    idempotencyKey: text("idempotency_key"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("orders_number_uq").on(t.orderNumber),
    uniqueIndex("orders_idempotency_uq").on(t.profileId, t.idempotencyKey),
    index("orders_profile_idx").on(t.profileId, t.createdAt),
    index("orders_status_idx").on(t.status, t.createdAt),
    index("orders_expiry_idx").on(t.status, t.expiresAt), // used by the expiry cron
    index("orders_attention_idx").on(t.attentionReason),
    check("orders_total_ok", sql`${t.totalPaise} = ${t.subtotalPaise} - ${t.discountPaise} + ${t.shippingPaise}`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    // Snapshot fields: catalogue changes never mutate existing orders.
    productName: text("product_name").notNull(),
    variantLabel: text("variant_label").notNull(),
    sku: text("sku").notNull(),
    unitPricePaise: integer("unit_price_paise").notNull(),
    quantity: integer("quantity").notNull(),
    lineTotalPaise: integer("line_total_paise").notNull(), // unitPricePaise * quantity
    createdAt: createdAt(),
  },
  (t) => [
    index("order_items_order_idx").on(t.orderId),
    check("items_qty_ok", sql`${t.quantity} > 0`),
    check("items_total_ok", sql`${t.lineTotalPaise} = ${t.unitPricePaise} * ${t.quantity}`),
  ],
);

/* ----------------------------- Payments ----------------------------------- */

export const payments = pgTable(
  "payments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    razorpayOrderId: text("razorpay_order_id").notNull(),
    razorpayPaymentId: text("razorpay_payment_id"),
    amountPaise: integer("amount_paise").notNull(),
    currency: text("currency").notNull().default("INR"),
    status: paymentStatus("status").notNull().default("created"),
    method: text("method"), // "upi", "card", "netbanking"...
    failureReason: text("failure_reason"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("payments_rzp_order_uq").on(t.razorpayOrderId),
    index("payments_order_idx").on(t.orderId),
    index("payments_rzp_payment_idx").on(t.razorpayPaymentId),
  ],
);

// Razorpay can deliver the same webhook more than once. Insert the event id
// first; if the insert conflicts, you've already handled it, so stop.
export const webhookEvents = pgTable("webhook_events", {
  id: text("id").primaryKey(), // x-razorpay-event-id header
  provider: text("provider").notNull().default("razorpay"),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ----------------------------- Shipping ----------------------------------- */
// `provider` + `externalShipmentId` keep this courier-agnostic.

export const shipments = pgTable(
  "shipments",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    provider: text("provider").notNull(), // "shiprocket", "delhivery", "manual"...
    externalShipmentId: text("external_shipment_id"),
    courierName: text("courier_name"),
    awb: text("awb"), // tracking number
    trackingUrl: text("tracking_url"),
    status: shipmentStatus("status").notNull().default("created"),
    shippedAt: timestamp("shipped_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("shipments_order_idx").on(t.orderId), index("shipments_awb_idx").on(t.awb)],
);

export const shipmentTrackingEvents = pgTable(
  "shipment_tracking_events",
  {
    id: id(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    status: shipmentStatus("status").notNull(),
    description: text("description"),
    location: text("location"),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("tracking_events_shipment_idx").on(t.shipmentId, t.occurredAt)],
);

/* ------------------------------ Reviews ----------------------------------- */

export const reviews = pgTable(
  "reviews",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    // Linking to the purchased line item gives you verified-purchase reviews
    // and prevents more than one review per purchase.
    orderItemId: uuid("order_item_id").references(() => orderItems.id, { onDelete: "set null" }),
    rating: integer("rating").notNull(),
    title: text("title"),
    body: text("body"),
    status: reviewStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productId, t.status),
    uniqueIndex("reviews_order_item_uq").on(t.orderItemId),
    check("reviews_rating_ok", sql`${t.rating} BETWEEN 1 AND 5`),
  ],
);

/* ------------------------------ Settings ---------------------------------- */

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(), // "shipping", "contact", "free_shipping_threshold"...
  value: jsonb("value").notNull(),
  updatedAt: updatedAt(),
});

/* ----------------------------- Relations ---------------------------------- */

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, { fields: [products.categoryId], references: [categories.id] }),
  images: many(productImages),
  variants: many(productVariants),
  reviews: many(reviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, { fields: [productImages.productId], references: [products.id] }),
}));

export const productVariantsRelations = relations(productVariants, ({ one }) => ({
  product: one(products, { fields: [productVariants.productId], references: [products.id] }),
}));

export const profilesRelations = relations(profiles, ({ one, many }) => ({
  addresses: many(addresses),
  orders: many(orders),
  cart: one(carts),
  sessions: many(sessions),
  passwordResetTokens: many(passwordResetTokens),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  profile: one(profiles, { fields: [sessions.profileId], references: [profiles.id] }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  profile: one(profiles, { fields: [passwordResetTokens.profileId], references: [profiles.id] }),
}));

export const cartsRelations = relations(carts, ({ one, many }) => ({
  profile: one(profiles, { fields: [carts.profileId], references: [profiles.id] }),
  items: many(cartItems),
}));

export const cartItemsRelations = relations(cartItems, ({ one }) => ({
  cart: one(carts, { fields: [cartItems.cartId], references: [carts.id] }),
  variant: one(productVariants, { fields: [cartItems.variantId], references: [productVariants.id] }),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  profile: one(profiles, { fields: [orders.profileId], references: [profiles.id] }),
  items: many(orderItems),
  payments: many(payments),
  shipments: many(shipments),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
  product: one(products, { fields: [orderItems.productId], references: [products.id] }),
  variant: one(productVariants, { fields: [orderItems.variantId], references: [productVariants.id] }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, { fields: [payments.orderId], references: [orders.id] }),
}));

export const shipmentsRelations = relations(shipments, ({ one, many }) => ({
  order: one(orders, { fields: [shipments.orderId], references: [orders.id] }),
  events: many(shipmentTrackingEvents),
}));

export const shipmentTrackingEventsRelations = relations(shipmentTrackingEvents, ({ one }) => ({
  shipment: one(shipments, {
    fields: [shipmentTrackingEvents.shipmentId],
    references: [shipments.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  product: one(products, { fields: [reviews.productId], references: [products.id] }),
  profile: one(profiles, { fields: [reviews.profileId], references: [profiles.id] }),
  orderItem: one(orderItems, { fields: [reviews.orderItemId], references: [orderItems.id] }),
}));

/* --------------------------- Admin Audit Log ------------------------------ */

export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: id(),
    actorProfileId: uuid("actor_profile_id").references(() => profiles.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("audit_entity_idx").on(t.entityType, t.entityId, t.createdAt),
    index("audit_action_idx").on(t.action, t.createdAt),
  ],
);

/* --------------------------- Rate Limiting ------------------------------- */

export const rateLimits = pgTable(
  "rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull().default(1),
    resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("rate_limits_reset_at_idx").on(t.resetAt),
  ],
);

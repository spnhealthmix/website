import { and, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { orderItems, orders, products, profiles, reviews, type reviewStatus } from "../db/schema";
import type { AnyDb } from "../orders/common";
import { ApiError } from "../api/http";
import { writeAudit } from "../admin/audit";
import type {
  AdminReviewItem,
  AdminReviewsListResult,
  CustomerReviewEligibility,
  PaginatedReviews,
  ProductRatingSummary,
  PublicReview,
  RatingDistribution,
  ReviewStatus,
} from "./types";

const QUALIFYING_ORDER_STATUSES: ("confirmed" | "processing" | "packed" | "shipped" | "delivered")[] = [
  "confirmed",
  "processing",
  "packed",
  "shipped",
  "delivered",
];

/**
 * Calculates deterministic server-authoritative rating summary for a product.
 * Only reviews with status === 'published' are counted.
 */
export async function getProductRatingSummary(
  db: AnyDb,
  productId: string,
): Promise<ProductRatingSummary> {
  const rows = await db
    .select({
      rating: reviews.rating,
      count: sql<number>`count(*)::int`,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.status, "published")))
    .groupBy(reviews.rating);

  const distribution: RatingDistribution = {
    1: 0,
    2: 0,
    3: 0,
    4: 0,
    5: 0,
  };

  let totalReviews = 0;
  let totalRatingSum = 0;

  for (const r of rows) {
    if (r.rating >= 1 && r.rating <= 5) {
      distribution[r.rating as keyof RatingDistribution] = r.count;
      totalReviews += r.count;
      totalRatingSum += r.rating * r.count;
    }
  }

  const rawAverage = totalReviews > 0 ? totalRatingSum / totalReviews : 0;
  // Round to exactly 1 decimal place (e.g. 4.666 -> 4.7)
  const averageRating = totalReviews > 0 ? Math.round(rawAverage * 10) / 10 : 0;

  return {
    averageRating,
    totalReviews,
    distribution,
  };
}

/**
 * Lists published product reviews with pagination and rating filtering.
 * Never exposes customer email, phone, or internal identifiers.
 */
export async function listProductReviews(
  db: AnyDb,
  productId: string,
  opts: {
    page?: number;
    limit?: number;
    rating?: number;
    sort?: "recent" | "highest" | "lowest";
  } = {},
): Promise<PaginatedReviews> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 10));
  const offset = (page - 1) * limit;

  const conditions = [
    eq(reviews.productId, productId),
    eq(reviews.status, "published"),
  ];

  if (opts.rating && opts.rating >= 1 && opts.rating <= 5) {
    conditions.push(eq(reviews.rating, opts.rating));
  }

  const whereClause = and(...conditions);

  // Get total count matching criteria
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .where(whereClause);

  // Determine sort order
  let orderByClause;
  switch (opts.sort) {
    case "highest":
      orderByClause = [desc(reviews.rating), desc(reviews.createdAt)];
      break;
    case "lowest":
      orderByClause = [reviews.rating, desc(reviews.createdAt)];
      break;
    case "recent":
    default:
      orderByClause = [desc(reviews.createdAt)];
      break;
  }

  const rows = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      orderItemId: reviews.orderItemId,
      createdAt: reviews.createdAt,
      authorName: profiles.name,
    })
    .from(reviews)
    .leftJoin(profiles, eq(profiles.id, reviews.profileId))
    .where(whereClause)
    .orderBy(...orderByClause)
    .limit(limit)
    .offset(offset);

  const formattedReviews: PublicReview[] = rows.map((r) => ({
    id: r.id,
    rating: r.rating,
    title: r.title,
    body: r.body,
    authorName: r.authorName?.trim() || "Customer",
    verifiedPurchase: Boolean(r.orderItemId),
    createdAt: r.createdAt.toISOString(),
  }));

  const summary = await getProductRatingSummary(db, productId);
  const totalPages = Math.ceil(total / limit) || 1;

  return {
    reviews: formattedReviews,
    summary,
    page,
    limit,
    total,
    totalPages,
  };
}

/**
 * Checks if a customer is eligible to review a product.
 * Derives verified-purchase status from completed/qualifying orders.
 */
export async function checkReviewEligibility(
  db: AnyDb,
  profileId: string,
  productId: string,
): Promise<CustomerReviewEligibility> {
  // Check if customer already submitted an active review
  const [existing] = await db
    .select({
      id: reviews.id,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      orderItemId: reviews.orderItemId,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.profileId, profileId)))
    .limit(1);

  // Check qualifying purchases in orders
  const qualifyingPurchases = await db
    .select({
      orderItemId: orderItems.id,
      orderStatus: orders.status,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .where(
      and(
        eq(orders.profileId, profileId),
        eq(orderItems.productId, productId),
        inArray(orders.status, QUALIFYING_ORDER_STATUSES),
      ),
    )
    .orderBy(desc(orders.createdAt));

  const hasPurchased = qualifyingPurchases.length > 0;
  const alreadyReviewed = Boolean(existing && existing.status !== "hidden");

  return {
    canReview: !alreadyReviewed,
    alreadyReviewed,
    verifiedPurchase: hasPurchased,
    reason: alreadyReviewed
      ? "You have already reviewed this product."
      : undefined,
    existingReview: existing
      ? {
          id: existing.id,
          rating: existing.rating,
          title: existing.title,
          body: existing.body,
          status: existing.status as ReviewStatus,
          verifiedPurchase: Boolean(existing.orderItemId),
          createdAt: existing.createdAt.toISOString(),
        }
      : null,
  };
}

/**
 * Submits a new review for a product.
 * Enforces one active review per customer per product.
 * Derives verified-purchase authoritative status from orders/orderItems.
 */
export async function submitReview(
  db: AnyDb,
  profileId: string,
  productId: string,
  input: {
    rating: number;
    title?: string | null;
    body: string;
  },
): Promise<PublicReview & { status: ReviewStatus }> {
  // Verify product exists
  const [product] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product) {
    throw new ApiError(404, "PRODUCT_NOT_FOUND", "Product not found.");
  }

  // Check for existing review
  const [existing] = await db
    .select({
      id: reviews.id,
      status: reviews.status,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.profileId, profileId)))
    .limit(1);

  if (existing && existing.status !== "hidden") {
    throw new ApiError(
      409,
      "DUPLICATE_REVIEW",
      "You have already submitted a review for this product. You can edit your existing review.",
    );
  }

  // Find qualifying orderItem for verified purchase that hasn't already been used
  const [qualifyingItem] = await db
    .select({
      orderItemId: orderItems.id,
    })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .leftJoin(reviews, eq(reviews.orderItemId, orderItems.id))
    .where(
      and(
        eq(orders.profileId, profileId),
        eq(orderItems.productId, productId),
        inArray(orders.status, QUALIFYING_ORDER_STATUSES),
        sql`${reviews.id} IS NULL`, // Ensure this orderItem isn't already linked
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(1);

  const orderItemId = qualifyingItem?.orderItemId ?? null;
  const isVerified = Boolean(orderItemId);

  // Verified purchase reviews can be immediately published, or start as pending if moderation required
  // Setting verified reviews to 'published' and unverified to 'pending' is standard anti-spam practice.
  const initialStatus: ReviewStatus = isVerified ? "published" : "pending";

  let reviewRow;

  if (existing && existing.status === "hidden") {
    // Re-activate previously soft-deleted review
    const [updated] = await db
      .update(reviews)
      .set({
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        orderItemId,
        status: initialStatus,
        createdAt: new Date(),
      })
      .where(eq(reviews.id, existing.id))
      .returning();
    reviewRow = updated;
  } else {
    // Insert new review
    const [inserted] = await db
      .insert(reviews)
      .values({
        productId,
        profileId,
        orderItemId,
        rating: input.rating,
        title: input.title ?? null,
        body: input.body,
        status: initialStatus,
      })
      .returning();
    reviewRow = inserted;
  }

  // Fetch author name for response
  const [profile] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  return {
    id: reviewRow.id,
    rating: reviewRow.rating,
    title: reviewRow.title,
    body: reviewRow.body,
    authorName: profile?.name?.trim() || "Customer",
    verifiedPurchase: Boolean(reviewRow.orderItemId),
    createdAt: reviewRow.createdAt.toISOString(),
    status: reviewRow.status as ReviewStatus,
  };
}

/**
 * Updates a customer's own review.
 * Server verifies that authenticated customer owns the review.
 */
export async function updateOwnReview(
  db: AnyDb,
  profileId: string,
  reviewId: string,
  input: {
    rating: number;
    title?: string | null;
    body: string;
  },
): Promise<PublicReview & { status: ReviewStatus }> {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
  }

  if (existing.profileId !== profileId) {
    throw new ApiError(403, "FORBIDDEN", "You can only edit your own reviews.");
  }

  const [updated] = await db
    .update(reviews)
    .set({
      rating: input.rating,
      title: input.title ?? null,
      body: input.body,
    })
    .where(eq(reviews.id, reviewId))
    .returning();

  const [profile] = await db
    .select({ name: profiles.name })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);

  return {
    id: updated.id,
    rating: updated.rating,
    title: updated.title,
    body: updated.body,
    authorName: profile?.name?.trim() || "Customer",
    verifiedPurchase: Boolean(updated.orderItemId),
    createdAt: updated.createdAt.toISOString(),
    status: updated.status as ReviewStatus,
  };
}

/**
 * Soft-deletes a customer's own review by setting status to 'hidden'.
 * Preserves relational integrity and database constraints.
 */
export async function deleteOwnReview(
  db: AnyDb,
  profileId: string,
  reviewId: string,
): Promise<{ success: true }> {
  const [existing] = await db
    .select()
    .from(reviews)
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!existing) {
    throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
  }

  if (existing.profileId !== profileId) {
    throw new ApiError(403, "FORBIDDEN", "You can only delete your own reviews.");
  }

  await db
    .update(reviews)
    .set({ status: "hidden" })
    .where(eq(reviews.id, reviewId));

  return { success: true };
}

/**
 * Lists all reviews written by the authenticated customer.
 */
export async function listCustomerReviews(
  db: AnyDb,
  profileId: string,
) {
  const rows = await db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      productSlug: products.slug,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      orderItemId: reviews.orderItemId,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .where(and(eq(reviews.profileId, profileId), sql`${reviews.status} <> 'hidden'`))
    .orderBy(desc(reviews.createdAt));

  return rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    productSlug: r.productSlug,
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status as ReviewStatus,
    verifiedPurchase: Boolean(r.orderItemId),
    createdAt: r.createdAt.toISOString(),
  }));
}

/* ----------------------------- Admin Operations --------------------------- */

/**
 * Admin: List reviews across the platform with filtering, search, and pagination.
 */
export async function adminListReviews(
  db: AnyDb,
  opts: {
    page?: number;
    limit?: number;
    status?: ReviewStatus;
    productId?: string;
    rating?: number;
    verifiedOnly?: boolean;
    search?: string;
  } = {},
): Promise<AdminReviewsListResult> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts.limit ?? 20));
  const offset = (page - 1) * limit;

  const conditions = [];

  if (opts.status) {
    conditions.push(eq(reviews.status, opts.status));
  }
  if (opts.productId) {
    conditions.push(eq(reviews.productId, opts.productId));
  }
  if (opts.rating && opts.rating >= 1 && opts.rating <= 5) {
    conditions.push(eq(reviews.rating, opts.rating));
  }
  if (opts.verifiedOnly) {
    conditions.push(sql`${reviews.orderItemId} IS NOT NULL`);
  }
  if (opts.search && opts.search.trim()) {
    const term = `%${opts.search.trim()}%`;
    conditions.push(
      or(
        ilike(products.name, term),
        ilike(profiles.name, term),
        ilike(profiles.email, term),
        ilike(reviews.title, term),
        ilike(reviews.body, term),
      ),
    );
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .innerJoin(profiles, eq(profiles.id, reviews.profileId))
    .where(whereClause);

  const rows = await db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      productSlug: products.slug,
      profileId: reviews.profileId,
      reviewerName: profiles.name,
      reviewerEmail: profiles.email,
      orderItemId: reviews.orderItemId,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .innerJoin(profiles, eq(profiles.id, reviews.profileId))
    .where(whereClause)
    .orderBy(desc(reviews.createdAt))
    .limit(limit)
    .offset(offset);

  const formatted: AdminReviewItem[] = rows.map((r) => ({
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    productSlug: r.productSlug,
    profileId: r.profileId,
    reviewerName: r.reviewerName,
    reviewerEmail: r.reviewerEmail,
    orderItemId: r.orderItemId,
    verifiedPurchase: Boolean(r.orderItemId),
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status as ReviewStatus,
    createdAt: r.createdAt.toISOString(),
  }));

  const totalPages = Math.ceil(total / limit) || 1;

  return {
    reviews: formatted,
    page,
    limit,
    total,
    totalPages,
  };
}

/**
 * Admin: Get single review details.
 */
export async function adminGetReview(
  db: AnyDb,
  reviewId: string,
): Promise<AdminReviewItem> {
  const [r] = await db
    .select({
      id: reviews.id,
      productId: reviews.productId,
      productName: products.name,
      productSlug: products.slug,
      profileId: reviews.profileId,
      reviewerName: profiles.name,
      reviewerEmail: profiles.email,
      orderItemId: reviews.orderItemId,
      rating: reviews.rating,
      title: reviews.title,
      body: reviews.body,
      status: reviews.status,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .innerJoin(products, eq(products.id, reviews.productId))
    .innerJoin(profiles, eq(profiles.id, reviews.profileId))
    .where(eq(reviews.id, reviewId))
    .limit(1);

  if (!r) {
    throw new ApiError(404, "REVIEW_NOT_FOUND", "Review not found.");
  }

  return {
    id: r.id,
    productId: r.productId,
    productName: r.productName,
    productSlug: r.productSlug,
    profileId: r.profileId,
    reviewerName: r.reviewerName,
    reviewerEmail: r.reviewerEmail,
    orderItemId: r.orderItemId,
    verifiedPurchase: Boolean(r.orderItemId),
    rating: r.rating,
    title: r.title,
    body: r.body,
    status: r.status as ReviewStatus,
    createdAt: r.createdAt.toISOString(),
  };
}

/**
 * Admin: Moderate a review (approve/publish, hide/reject, or pending).
 * Audits the action in admin_audit_log.
 */
export async function adminSetReviewStatus(
  db: AnyDb,
  adminId: string,
  reviewId: string,
  newStatus: ReviewStatus,
  adminNote?: string | null,
): Promise<AdminReviewItem> {
  const existing = await adminGetReview(db, reviewId);

  const [updated] = await db
    .update(reviews)
    .set({ status: newStatus })
    .where(eq(reviews.id, reviewId))
    .returning();

  let auditAction = "review.updated";
  if (newStatus === "published") auditAction = "review.approved";
  else if (newStatus === "hidden") auditAction = "review.rejected";

  await writeAudit(db, {
    actorProfileId: adminId,
    action: auditAction,
    entityType: "review",
    entityId: reviewId,
    details: {
      productId: existing.productId,
      productName: existing.productName,
      previousStatus: existing.status,
      newStatus,
      rating: existing.rating,
      adminNote: adminNote ?? null,
    },
  });

  return {
    ...existing,
    status: updated.status as ReviewStatus,
  };
}

/**
 * Admin: Remove a review (soft-deletes to hidden, audits the action).
 */
export async function adminDeleteReview(
  db: AnyDb,
  adminId: string,
  reviewId: string,
): Promise<{ success: true }> {
  const existing = await adminGetReview(db, reviewId);

  await db
    .update(reviews)
    .set({ status: "hidden" })
    .where(eq(reviews.id, reviewId));

  await writeAudit(db, {
    actorProfileId: adminId,
    action: "review.deleted",
    entityType: "review",
    entityId: reviewId,
    details: {
      productId: existing.productId,
      productName: existing.productName,
      previousStatus: existing.status,
      rating: existing.rating,
    },
  });

  return { success: true };
}

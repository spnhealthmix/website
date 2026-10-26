import type { reviewStatus } from "../db/schema";

export type ReviewStatus = (typeof reviewStatus.enumValues)[number]; // "pending" | "published" | "hidden"

export interface PublicReview {
  id: string;
  rating: number;
  title: string | null;
  body: string | null;
  authorName: string;
  verifiedPurchase: boolean;
  createdAt: string;
}

export interface RatingDistribution {
  1: number;
  2: number;
  3: number;
  4: number;
  5: number;
}

export interface ProductRatingSummary {
  averageRating: number;
  totalReviews: number;
  distribution: RatingDistribution;
}

export interface PaginatedReviews {
  reviews: PublicReview[];
  summary: ProductRatingSummary;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface CustomerReviewEligibility {
  canReview: boolean;
  reason?: string;
  alreadyReviewed: boolean;
  verifiedPurchase: boolean;
  existingReview?: {
    id: string;
    rating: number;
    title: string | null;
    body: string | null;
    status: ReviewStatus;
    verifiedPurchase: boolean;
    createdAt: string;
  } | null;
}

export interface AdminReviewItem {
  id: string;
  productId: string;
  productName: string;
  productSlug: string;
  profileId: string;
  reviewerName: string | null;
  reviewerEmail: string;
  orderItemId: string | null;
  verifiedPurchase: boolean;
  rating: number;
  title: string | null;
  body: string | null;
  status: ReviewStatus;
  createdAt: string;
}

export interface AdminReviewsListResult {
  reviews: AdminReviewItem[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

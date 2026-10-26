"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Star, Check, ArrowRight, MessageSquarePlus, LogIn, X } from "lucide-react";
import { RatingStars } from "./rating-stars";
import { ReviewForm } from "./review-form";
import { cn } from "@/lib/utils";
import type {
  CustomerReviewEligibility,
  PaginatedReviews,
  ProductRatingSummary,
  PublicReview,
} from "@/lib/reviews/types";

interface ProductReviewsSectionProps {
  productSlug: string;
  initialSummary?: ProductRatingSummary;
  className?: string;
}

function formatRelativeDate(isoDate: string): string {
  try {
    const date = new Date(isoDate);
    const now = Date.now();
    const diffMs = now - date.getTime();
    if (Number.isNaN(diffMs)) return "";

    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return "today";
    if (diffDays === 1) return "yesterday";
    if (diffDays < 7) return `${diffDays} days ago`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks === 1) return "1 week ago";
    if (diffWeeks < 4) return `${diffWeeks} weeks ago`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths === 1) return "1 month ago";
    if (diffMonths < 12) return `${diffMonths} months ago`;
    const diffYears = Math.floor(diffDays / 365);
    if (diffYears === 1) return "1 year ago";
    return `${diffYears} years ago`;
  } catch {
    return "";
  }
}

export function ProductReviewsSection({
  productSlug,
  initialSummary,
  className,
}: ProductReviewsSectionProps) {
  const [reviewsData, setReviewsData] = useState<PaginatedReviews | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Customer eligibility & form state
  const [eligibility, setEligibility] = useState<CustomerReviewEligibility | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [editingReview, setEditingReview] = useState<PublicReview | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // 1. Fetch public reviews list
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/catalogue/products/${productSlug}/reviews?page=1&limit=10&sort=recent`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        throw new Error("Unable to load reviews.");
      }
      const data: PaginatedReviews = await res.json();
      setReviewsData(data);
    } catch (err: any) {
      setError(err.message || "Failed to load reviews.");
    } finally {
      setLoading(false);
    }
  }, [productSlug]);

  // 2. Fetch customer eligibility & auth check
  const checkEligibility = useCallback(async () => {
    setCheckingAuth(true);
    try {
      const res = await fetch(`/api/catalogue/products/${productSlug}/reviews/eligibility`, {
        cache: "no-store",
      });
      if (res.ok) {
        const data: CustomerReviewEligibility = await res.json();
        setEligibility(data);
        setIsLoggedIn(true);
      } else if (res.status === 401) {
        setEligibility(null);
        setIsLoggedIn(false);
      } else {
        setEligibility(null);
        setIsLoggedIn(false);
      }
    } catch {
      setEligibility(null);
      setIsLoggedIn(false);
    } finally {
      setCheckingAuth(false);
    }
  }, [productSlug]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  useEffect(() => {
    checkEligibility();
  }, [checkEligibility]);

  const handleReviewSuccess = (_savedReview: PublicReview) => {
    setShowForm(false);
    setEditingReview(null);
    setNotification(
      editingReview
        ? "Your review was successfully updated."
        : "Thank you! Your review has been submitted."
    );
    setTimeout(() => setNotification(null), 5000);
    fetchReviews();
    checkEligibility();
  };

  const handleWriteReviewClick = () => {
    if (!isLoggedIn) {
      setShowAuthPrompt(true);
      setShowForm(false);
      return;
    }
    setShowAuthPrompt(false);
    setEditingReview(null);
    setShowForm(true);
  };

  const summary = reviewsData?.summary ?? initialSummary ?? {
    averageRating: 0,
    totalReviews: 0,
    distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };

  const hasReviews = summary.totalReviews > 0 && reviewsData && reviewsData.reviews.length > 0;
  // Small selection of up to 2 actual customer reviews matching the reference image layout
  const displayedReviews = reviewsData?.reviews.slice(0, 2) ?? [];

  return (
    <section
      id="reviews"
      aria-labelledby="customer-reviews-heading"
      className={cn(
        "bg-white rounded-[16px] border border-[#E8DFD4] p-6 sm:p-7 lg:p-8 flex flex-col h-full shadow-[0_2px_8px_rgba(0,0,0,0.02)]",
        className
      )}
    >
      {/* Header: Title and Write a Review action */}
      <div className="flex items-center justify-between gap-3 mb-5 sm:mb-6">
        <h2
          id="customer-reviews-heading"
          className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-normal text-[#1A1614]"
        >
          Customer Reviews
        </h2>

        {!showForm && !showAuthPrompt && (
          <div className="flex items-center gap-3">
            {summary.totalReviews > 2 && (
              <button
                type="button"
                onClick={() => setShowAllModal(true)}
                className="text-xs sm:text-[13px] font-semibold text-[#BF5330] hover:text-[#8F3E20] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}

            <button
              type="button"
              onClick={handleWriteReviewClick}
              className="text-xs sm:text-[13px] font-semibold text-[#BF5330] hover:text-[#8F3E20] inline-flex items-center gap-1 transition-colors cursor-pointer"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{eligibility?.existingReview ? "Edit Review" : "Write a Review"}</span>
            </button>
          </div>
        )}
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs sm:text-sm rounded-[10px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="font-medium">{notification}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-emerald-700 hover:text-emerald-900 font-bold ml-2 p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm rounded-[10px] flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-rose-700 hover:text-rose-900 font-bold ml-2 p-1"
          >
            ×
          </button>
        </div>
      )}

      {/* Auth Prompt for unauthenticated customers */}
      {showAuthPrompt && (
        <div className="mb-4 p-5 bg-[#FAF5EE] border border-[#E8DFD4] rounded-[12px] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="font-[family-name:var(--font-body)] text-sm font-semibold text-[#1A1614] flex items-center gap-2">
              <LogIn className="w-4 h-4 text-[#BF5330]" />
              <span>Sign in required</span>
            </p>
            <p className="font-[family-name:var(--font-body)] text-xs text-[#635850] mt-1">
              Please sign in to share your honest thoughts about this product.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/login?redirect_url=/products/${productSlug}#reviews`}
              className="bg-[#BF5330] hover:bg-[#8F3E20] text-white text-xs font-semibold px-4 py-2 rounded-[8px] transition-colors shadow-xs"
            >
              Sign In to Review
            </Link>
            <button
              type="button"
              onClick={() => setShowAuthPrompt(false)}
              className="text-[#635850] hover:text-[#1A1614] text-xs font-medium px-3 py-2 rounded-[8px] hover:bg-black/5"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Review Form (Inline Drawer) */}
      {showForm && (
        <div className="mb-6 p-5 sm:p-6 bg-[#FAF5EE]/60 border border-[#E8DFD4] rounded-[12px]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-[family-name:var(--font-heading)] text-lg font-normal text-[#1A1614]">
              {editingReview ? "Edit Your Review" : "Write a Customer Review"}
            </h3>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingReview(null);
              }}
              className="text-[#635850] hover:text-[#1A1614] p-1 rounded hover:bg-[#E8DFD4]/50 cursor-pointer"
              aria-label="Close review form"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <ReviewForm
            productSlug={productSlug}
            initialReview={editingReview}
            verifiedPurchase={eligibility?.verifiedPurchase}
            onSuccess={handleReviewSuccess}
            onCancel={() => {
              setShowForm(false);
              setEditingReview(null);
            }}
          />
        </div>
      )}

      {/* Reviews Content: Reference Layout with Summary on Left and Reviews on Right */}
      {loading && !reviewsData ? (
        <div className="py-10 text-center text-[#635850] flex-1 flex flex-col items-center justify-center">
          <div className="inline-block animate-spin rounded-full h-6 w-6 border-2 border-[#BF5330] border-t-transparent mb-2" />
          <p className="text-xs font-medium">Loading reviews...</p>
        </div>
      ) : hasReviews ? (
        <div className="grid grid-cols-1 sm:grid-cols-[130px_1fr] md:grid-cols-[140px_1fr] gap-6 sm:gap-8 items-start flex-1">
          {/* Left summary block matching reference image */}
          <div className="flex flex-col items-start sm:border-r sm:border-[#E8DFD4]/70 sm:pr-6 shrink-0">
            <div className="flex items-baseline gap-1.5 mb-1.5">
              <span className="font-[family-name:var(--font-price)] text-3xl sm:text-[38px] font-extrabold text-[#1A1614] leading-none tracking-tight">
                {summary.averageRating.toFixed(1)}
              </span>
              <span className="font-[family-name:var(--font-body)] text-[13px] font-medium text-[#635850]">
                / 5
              </span>
            </div>
            <RatingStars rating={summary.averageRating} size="md" />
            <p className="font-[family-name:var(--font-body)] text-xs text-[#635850] mt-2 font-medium">
              {summary.totalReviews} {summary.totalReviews === 1 ? "review" : "reviews"}
            </p>
          </div>

          {/* Right reviews list matching reference image */}
          <div className="space-y-4 flex-1">
            {displayedReviews.map((review) => {
              const initial = review.authorName?.trim() ? review.authorName.trim().charAt(0).toUpperCase() : "C";
              const relativeDate = formatRelativeDate(review.createdAt);

              return (
                <div key={review.id} className="flex items-start gap-3">
                  {/* Circle avatar with initial */}
                  <div
                    className="w-8 h-8 rounded-full bg-[#FAF5EE] border border-[#E8DFD4] text-[#BF5330] font-semibold text-xs flex items-center justify-center shrink-0 uppercase select-none shadow-2xs"
                    aria-hidden="true"
                  >
                    {initial}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-[family-name:var(--font-body)] text-xs sm:text-[13px] font-semibold text-[#1A1614] truncate">
                        {review.authorName}
                      </span>
                      <RatingStars rating={review.rating} size="sm" />
                      {relativeDate && (
                        <span className="font-[family-name:var(--font-body)] text-[11px] text-[#635850]">
                          {relativeDate}
                        </span>
                      )}
                    </div>
                    <p className="font-[family-name:var(--font-body)] text-xs sm:text-[13px] text-[#635850] line-clamp-2 mt-1 leading-relaxed">
                      {review.body}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Empty state: No reviews yet */
        <div className="py-8 text-center flex-1 flex flex-col items-center justify-center bg-[#FFFBF7] rounded-[12px] border border-[#E8DFD4]/60 p-6">
          <div className="w-10 h-10 rounded-full bg-[#FAF5EE] border border-[#E8DFD4] flex items-center justify-center text-[#BF5330] mb-3 shadow-2xs">
            <Star className="w-5 h-5 fill-[#BF5330]/20 text-[#BF5330]" />
          </div>
          <h3 className="font-[family-name:var(--font-body)] text-base font-semibold text-[#1A1614]">
            No reviews yet
          </h3>
          <p className="font-[family-name:var(--font-body)] text-xs sm:text-[13px] text-[#635850] mt-1 max-w-xs">
            Be the first to share your honest thoughts about this product!
          </p>
          <button
            type="button"
            onClick={handleWriteReviewClick}
            className="mt-4 inline-flex items-center justify-center px-4.5 py-2 rounded-[8px] text-xs sm:text-sm font-medium text-white bg-[#BF5330] hover:bg-[#8F3E20] transition-colors shadow-xs cursor-pointer font-[family-name:var(--font-body)]"
          >
            Write the First Review
          </button>
        </div>
      )}

      {/* View All Reviews Modal */}
      {showAllModal && reviewsData && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-center justify-center p-4">
          <div className="bg-white rounded-[16px] border border-[#E8DFD4] max-w-lg w-full max-h-[85vh] flex flex-col shadow-xl animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-[#E8DFD4] flex items-center justify-between">
              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-xl font-normal text-[#1A1614]">
                  All Customer Reviews
                </h3>
                <p className="text-xs text-[#635850] mt-0.5">
                  {summary.totalReviews} verified reviews • {summary.averageRating.toFixed(1)} / 5 stars
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowAllModal(false)}
                className="p-1 rounded-md text-[#635850] hover:text-[#1A1614] hover:bg-[#FAF5EE]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto space-y-4 divide-y divide-[#E8DFD4]/60">
              {reviewsData.reviews.map((review) => {
                const initial = review.authorName?.trim() ? review.authorName.trim().charAt(0).toUpperCase() : "C";
                const relativeDate = formatRelativeDate(review.createdAt);

                return (
                  <div key={review.id} className="pt-3.5 first:pt-0 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#FAF5EE] border border-[#E8DFD4] text-[#BF5330] font-semibold text-xs flex items-center justify-center shrink-0 uppercase">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-xs sm:text-sm text-[#1A1614]">
                          {review.authorName}
                        </span>
                        <RatingStars rating={review.rating} size="sm" />
                        {relativeDate && (
                          <span className="text-[11px] text-[#635850]">
                            {relativeDate}
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-[#635850] mt-1 leading-relaxed">
                        {review.body}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

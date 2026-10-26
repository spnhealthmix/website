"use client";

import React from "react";
import { RatingStars } from "./rating-stars";
import type { PublicReview } from "@/lib/reviews/types";

interface ReviewCardProps {
  review: PublicReview;
  isOwnReview?: boolean;
  onEdit?: (review: PublicReview) => void;
  onDelete?: (reviewId: string) => void;
  isDeleting?: boolean;
}

export function ReviewCard({
  review,
  isOwnReview = false,
  onEdit,
  onDelete,
  isDeleting = false,
}: ReviewCardProps) {
  const formattedDate = new Date(review.createdAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <article className="p-5 sm:p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-xs transition-shadow hover:shadow-sm">
      {/* Header row: Author, verified badge, rating, date */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-[var(--color-border)]/60">
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Author avatar initial */}
          <div className="w-8 h-8 rounded-full bg-[#ECC484]/30 border border-[#ECC484] flex items-center justify-center font-bold text-xs text-[#824629]">
            {review.authorName.charAt(0).toUpperCase()}
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-[var(--color-text-primary)]">
                {review.authorName}
              </span>

              {/* Server-authoritative Verified Purchase Badge */}
              {review.verifiedPurchase && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <svg className="w-3 h-3 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Verified Purchase
                </span>
              )}

              {isOwnReview && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
                  Your Review
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Rating and date */}
        <div className="flex items-center gap-3">
          <RatingStars rating={review.rating} size="sm" />
          <time dateTime={review.createdAt} className="text-xs text-[var(--color-text-muted)]">
            {formattedDate}
          </time>
        </div>
      </div>

      {/* Content */}
      <div className="mt-3.5 space-y-1.5">
        {review.title && (
          <h4 className="font-bold text-base text-[var(--color-text-primary)] leading-snug">
            {review.title}
          </h4>
        )}

        {/* Safe text rendering — NEVER raw HTML or dangerouslySetInnerHTML */}
        <p className="text-sm leading-relaxed text-[var(--color-text-body)] whitespace-pre-line">
          {review.body}
        </p>
      </div>

      {/* Customer own actions */}
      {isOwnReview && (onEdit || onDelete) && (
        <div className="mt-4 pt-3 border-t border-[var(--color-border)]/60 flex items-center justify-end gap-2 text-xs">
          {onEdit && (
            <button
              type="button"
              onClick={() => onEdit(review)}
              className="px-3 py-1 font-semibold text-[#824629] hover:bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-lg transition-colors"
            >
              Edit Review
            </button>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={() => onDelete(review.id)}
              disabled={isDeleting}
              className="px-3 py-1 font-medium text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
          )}
        </div>
      )}
    </article>
  );
}

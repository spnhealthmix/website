"use client";

import React from "react";
import { RatingStars } from "./rating-stars";
import type { ProductRatingSummary } from "@/lib/reviews/types";

interface RatingSummaryCardProps {
  summary: ProductRatingSummary;
  selectedRating?: number;
  onSelectRating?: (rating: number | undefined) => void;
  onWriteReviewClick?: () => void;
  canReview?: boolean;
}

export function RatingSummaryCard({
  summary,
  selectedRating,
  onSelectRating,
  onWriteReviewClick,
  canReview = true,
}: RatingSummaryCardProps) {
  const { averageRating, totalReviews, distribution } = summary;

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl p-6 lg:p-8 shadow-sm">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
        {/* Left score column */}
        <div className="md:col-span-5 flex flex-col items-center justify-center text-center md:border-r border-[var(--color-border)] md:pr-8">
          <div className="text-5xl lg:text-6xl font-extrabold text-[var(--color-text-primary)] font-price tracking-tight">
            {totalReviews > 0 ? averageRating.toFixed(1) : "0.0"}
          </div>

          <div className="mt-2.5">
            <RatingStars rating={averageRating} size="lg" />
          </div>

          <p className="mt-2 text-sm text-[var(--color-text-muted)] font-medium">
            {totalReviews === 0
              ? "No ratings yet"
              : `Based on ${totalReviews} verified review${totalReviews === 1 ? "" : "s"}`}
          </p>

          {onWriteReviewClick && canReview && (
            <button
              type="button"
              onClick={onWriteReviewClick}
              className="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-[8px] text-sm font-semibold text-white bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98] transition-all shadow-sm font-[family-name:var(--font-body)]"
            >
              Write a Review
            </button>
          )}
        </div>

        {/* Right distribution breakdown column */}
        <div className="md:col-span-7 space-y-2.5 font-[family-name:var(--font-body)]">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars as keyof typeof distribution] || 0;
            const percentage = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
            const isSelected = selectedRating === stars;

            return (
              <button
                key={stars}
                type="button"
                onClick={() => onSelectRating?.(isSelected ? undefined : stars)}
                className={`w-full flex items-center gap-3 text-xs font-medium py-1 px-2 rounded-[6px] transition-colors group ${
                  isSelected
                    ? "bg-[var(--color-brand-primary-light)] text-[var(--color-brand-primary)]"
                    : "text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)]"
                }`}
              >
                {/* Star label */}
                <span className="w-12 text-left font-semibold shrink-0">
                  {stars} Star{stars > 1 ? "s" : ""}
                </span>

                {/* Progress track */}
                <div className="flex-1 h-2.5 bg-[var(--color-surface-sunken)] rounded-full overflow-hidden border border-[var(--color-border)]/50">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSelected
                        ? "bg-[var(--color-brand-primary)]"
                        : "bg-[var(--color-turmeric-gold)] group-hover:bg-[var(--color-brand-primary)]"
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>

                {/* Percentage & count */}
                <span className="w-12 text-right text-[var(--color-text-muted)] shrink-0 font-mono text-[11px]">
                  {count} ({percentage}%)
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

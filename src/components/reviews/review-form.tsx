"use client";

import React, { useState } from "react";
import { RatingStars } from "./rating-stars";
import type { PublicReview } from "@/lib/reviews/types";

interface ReviewFormProps {
  productSlug: string;
  initialReview?: PublicReview | null;
  verifiedPurchase?: boolean;
  onSuccess: (review: PublicReview) => void;
  onCancel?: () => void;
}

export function ReviewForm({
  productSlug,
  initialReview,
  verifiedPurchase = false,
  onSuccess,
  onCancel,
}: ReviewFormProps) {
  const isEditing = Boolean(initialReview);

  const [rating, setRating] = useState<number>(initialReview?.rating || 5);
  const [title, setTitle] = useState<string>(initialReview?.title || "");
  const [body, setBody] = useState<string>(initialReview?.body || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (rating < 1 || rating > 5) {
      setError("Please select a rating between 1 and 5 stars.");
      return;
    }
    if (body.trim().length < 3) {
      setError("Review text must be at least 3 characters.");
      return;
    }
    if (body.trim().length > 2000) {
      setError("Review text cannot exceed 2000 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const endpoint = isEditing
        ? `/api/me/reviews/${initialReview!.id}`
        : `/api/catalogue/products/${productSlug}/reviews`;
      const method = isEditing ? "PATCH" : "POST";

      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          title: title.trim() || null,
          body: body.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 401) {
          throw new Error("Please sign in to submit a review.");
        }
        if (res.status === 409) {
          throw new Error("You have already reviewed this product.");
        }
        throw new Error(data.error?.message || "Failed to submit review.");
      }

      const savedReview = await res.json();
      onSuccess(savedReview);
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl shadow-sm space-y-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-normal text-[var(--color-text-primary)] font-heading">
          {isEditing ? "Edit Your Review" : "Write a Customer Review"}
        </h3>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] font-medium rounded px-1.5 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)]"
          >
            Cancel
          </button>
        )}
      </div>

      {verifiedPurchase && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200/80 rounded-xl text-xs text-emerald-800">
          <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            <strong>Verified Purchase:</strong> You purchased this item on SPN Health Mix. Your review will display a verified badge.
          </span>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-rose-600 font-bold ml-2 rounded px-1 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-rose-500"
          >
            ×
          </button>
        </div>
      )}

      {/* Star rating picker */}
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)] mb-2 font-[family-name:var(--font-body)]">
          Your Rating <span className="text-[var(--color-brand-primary)]">*</span>
        </label>
        <div className="flex items-center gap-3">
          <RatingStars rating={rating} interactive size="lg" onChange={setRating} />
          <span className="text-sm font-semibold text-[var(--color-text-primary)] font-[family-name:var(--font-body)]">
            {
              {
                1: "1 - Poor",
                2: "2 - Fair",
                3: "3 - Good",
                4: "4 - Very Good",
                5: "5 - Excellent",
              }[rating]
            }
          </span>
        </div>
      </div>

      {/* Review title */}
      <div>
        <div className="flex items-center justify-between mb-1.5 font-[family-name:var(--font-body)]">
          <label
            htmlFor="review-title"
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Review Title <span className="text-[11px] font-normal normal-case">(optional)</span>
          </label>
          <span className="text-[11px] text-[var(--color-text-muted)]">{title.length}/100</span>
        </div>
        <input
          id="review-title"
          type="text"
          value={title}
          maxLength={100}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="E.g., Authentic taste, fresh aroma, great quality"
          className="w-full text-sm py-2.5 px-3.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-[8px] focus:outline-none focus:border-[var(--color-brand-primary)] focus-visible:ring-1 focus-visible:ring-[var(--color-brand-primary)] transition-colors font-[family-name:var(--font-body)] text-[var(--color-text-primary)]"
        />
      </div>

      {/* Review body */}
      <div>
        <div className="flex items-center justify-between mb-1.5 font-[family-name:var(--font-body)]">
          <label
            htmlFor="review-body"
            className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]"
          >
            Your Review <span className="text-[var(--color-brand-primary)]">*</span>
          </label>
          <span className="text-[11px] text-[var(--color-text-muted)]">{body.length}/2000</span>
        </div>
        <textarea
          id="review-body"
          value={body}
          maxLength={2000}
          rows={4}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you like or dislike about this product? How did you prepare or consume it?"
          className="w-full text-sm py-2.5 px-3.5 bg-[var(--color-surface-sunken)] border border-[var(--color-border)] rounded-[8px] focus:outline-none focus:border-[var(--color-brand-primary)] focus-visible:ring-1 focus-visible:ring-[var(--color-brand-primary)] transition-colors resize-y leading-relaxed font-[family-name:var(--font-body)] text-[var(--color-text-primary)]"
          required
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-3 pt-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="px-4 py-2.5 text-xs font-semibold text-[var(--color-text-body)] hover:bg-[var(--color-surface-sunken)] active:scale-[0.98] border border-[var(--color-border)] rounded-[8px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:opacity-50 disabled:cursor-not-allowed font-[family-name:var(--font-body)]"
          >
            Cancel
          </button>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center justify-center px-6 py-2.5 text-sm font-semibold text-white bg-[var(--color-brand-primary)] hover:bg-[var(--color-brand-primary-dark)] active:scale-[0.98] rounded-[8px] shadow-sm transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-brand-primary)] disabled:opacity-60 disabled:cursor-not-allowed font-[family-name:var(--font-body)]"
        >
          {submitting ? (
            <span className="flex items-center gap-2">
              <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Submitting...
            </span>
          ) : isEditing ? (
            "Update Review"
          ) : (
            "Submit Review"
          )}
        </button>
      </div>
    </form>
  );
}

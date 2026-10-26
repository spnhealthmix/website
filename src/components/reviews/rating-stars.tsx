"use client";

import React, { useState } from "react";

interface RatingStarsProps {
  rating: number; // 0 to 5
  size?: "sm" | "md" | "lg";
  interactive?: boolean;
  onChange?: (rating: number) => void;
  className?: string;
}

export function RatingStars({
  rating,
  size = "md",
  interactive = false,
  onChange,
  className = "",
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = useState<number | null>(null);

  const displayRating = interactive && hoverRating !== null ? hoverRating : rating;

  const sizeClasses = {
    sm: "w-3.5 h-3.5",
    md: "w-4 h-4",
    lg: "w-6 h-6",
  }[size];

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? "Rate from 1 to 5 stars" : `${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= Math.floor(displayRating);
        const isPartial = !isFilled && star === Math.ceil(displayRating) && !interactive;
        const fillPercent = isPartial ? Math.round((displayRating % 1) * 100) : 0;

        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            onClick={() => interactive && onChange?.(star)}
            onMouseEnter={() => interactive && setHoverRating(star)}
            onMouseLeave={() => interactive && setHoverRating(null)}
            className={`relative p-0 transition-transform ${
              interactive
                ? "cursor-pointer hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-primary)] rounded"
                : "cursor-default"
            }`}
            aria-label={interactive ? `${star} Star${star > 1 ? "s" : ""}` : undefined}
          >
            {/* Background empty star */}
            <svg
              className={`${sizeClasses} text-[var(--color-border)] fill-none stroke-current`}
              viewBox="0 0 24 24"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              />
            </svg>

            {/* Filled star or partial overlay */}
            {(isFilled || isPartial) && (
              <span
                className="absolute inset-0 overflow-hidden text-[var(--color-turmeric-gold)]"
                style={{ width: isFilled ? "100%" : `${fillPercent}%` }}
              >
                <svg
                  className={`${sizeClasses} fill-current text-[var(--color-turmeric-gold)]`}
                  viewBox="0 0 24 24"
                >
                  <path d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                </svg>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

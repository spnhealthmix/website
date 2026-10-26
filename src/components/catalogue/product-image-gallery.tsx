"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { ProductImage } from "@/lib/storefront/types";

interface ProductImageGalleryProps {
  images: ProductImage[];
  productName: string;
}

export function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div
        className="aspect-square rounded-[16px] sm:rounded-[20px] bg-[#FAF5EE] border border-[#E8DFD4] flex items-center justify-center"
        aria-label={`${productName} — no image available`}
      >
        <span
          className="font-[family-name:var(--font-heading)] text-6xl font-normal text-[#D4C5B5] select-none"
          aria-hidden
        >
          {productName.charAt(0)}
        </span>
      </div>
    );
  }

  // Ensure activeIndex is within bounds if images change
  const safeIndex = activeIndex < images.length ? activeIndex : 0;
  const activeImage = images[safeIndex];

  return (
    <div
      className="flex flex-col-reverse sm:flex-row gap-3.5 sm:gap-4 items-start w-full"
      role="region"
      aria-label="Product images"
    >
      {/* Vertical thumbnail column on desktop (left of main image), horizontal row below on mobile */}
      {images.length > 0 && (
        <div
          className="flex sm:flex-col gap-2.5 sm:gap-3 overflow-x-auto sm:overflow-y-auto max-h-[580px] scrollbar-hide py-0.5 sm:py-0 shrink-0 w-full sm:w-auto"
          role="list"
          aria-label="Product image thumbnails"
        >
          {images.map((img, index) => {
            const isSelected = index === safeIndex;
            return (
              <button
                key={img.url + index}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={cn(
                  "relative shrink-0 w-[60px] h-[60px] sm:w-[68px] sm:h-[68px] lg:w-[72px] lg:h-[72px] rounded-[10px] bg-[#FAF5EE] transition-all cursor-pointer p-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#BF5330]",
                  isSelected
                    ? "border-2 border-[#BF5330] shadow-2xs"
                    : "border border-[#E8DFD4] hover:border-[#BF5330]/50 opacity-80 hover:opacity-100"
                )}
                role="listitem"
                aria-label={`View image ${index + 1} of ${images.length}`}
                aria-pressed={isSelected}
              >
                <div className="relative w-full h-full rounded-[6px] overflow-hidden">
                  <Image
                    src={img.url}
                    alt={img.alt ?? `${productName} thumbnail ${index + 1}`}
                    fill
                    sizes="72px"
                    className="object-cover object-center"
                    loading="lazy"
                  />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Large primary product image beside the thumbnails */}
      <div className="relative flex-1 aspect-square sm:aspect-[4/3] lg:aspect-square w-full rounded-[16px] sm:rounded-[20px] overflow-hidden border border-[#E8DFD4] bg-[#FAF5EE] shadow-[0_2px_12px_rgba(0,0,0,0.03)]">
        <Image
          key={activeImage.url}
          src={activeImage.url}
          alt={activeImage.alt ?? productName}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 650px"
          className="object-cover object-center"
          priority
          fetchPriority="high"
        />
      </div>
    </div>
  );
}

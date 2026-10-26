"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export interface HeroSlide {
  id: number;
  portraitSrc: string;
  desktopSrc: string;
  alt: string;
  href: string;
}

export const HERO_SLIDES: HeroSlide[] = [
  {
    id: 1,
    portraitSrc: "/hero1.jpeg",
    desktopSrc: "/hero1-desktop.jpeg",
    alt: "SPN Health Mix Laddu's Combo — 5 Days Special Festival Offer",
    href: "/shop",
  },
  {
    id: 2,
    portraitSrc: "/hero2.jpeg",
    desktopSrc: "/hero2-desktop.jpeg",
    alt: "SPN Health Mix Special Offer — Nendram Banana Chips",
    href: "/shop",
  },
  {
    id: 3,
    portraitSrc: "/hero3.jpeg",
    desktopSrc: "/hero3-desktop.jpeg",
    alt: "SPN Health Mix Healthy Drinks Combo",
    href: "/shop",
  },
];

const AUTO_SLIDE_INTERVAL = 4500;
const HEADER_HEIGHT_PX = 64;

export function HeroSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const total = HERO_SLIDES.length;

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (isPaused) return;

    const timer = window.setInterval(goToNext, AUTO_SLIDE_INTERVAL);

    return () => window.clearInterval(timer);
  }, [isPaused, goToNext]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
    touchEndX.current = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null || touchEndX.current === null) return;

    const diff = touchStartX.current - touchEndX.current;

    if (diff > 40) goToNext();
    else if (diff < -40) goToPrev();

    touchStartX.current = null;
    touchEndX.current = null;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    if (e.key === "ArrowLeft") goToPrev();
    else if (e.key === "ArrowRight") goToNext();
  };

  return (
    <section
      aria-roledescription="carousel"
      aria-label="Promotional festival offers"
      onKeyDown={handleKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="
        relative isolate
        w-full max-w-full
        h-[min(56.25vw,calc(100svh-64px))]
        min-h-0
        overflow-hidden
        select-none
        bg-[#FAF5EE]
        max-md:aspect-[2/3]
        max-md:h-auto
      "
      style={{
        // Desktop: fit 16:9 while leaving room for the header.
        // Mobile: use the portrait aspect ratio instead.
        ["--hero-header-height" as string]: `${HEADER_HEIGHT_PX}px`,
      }}
    >
      {/* Carousel track */}
      <div
        className="
          absolute inset-0
          flex h-full w-full
          transition-transform duration-500 ease-in-out
          motion-reduce:transition-none
        "
        style={{
          transform: `translate3d(-${currentIndex * 100}%, 0, 0)`,
        }}
      >
        {HERO_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            role="group"
            aria-roledescription="slide"
            aria-label={`Slide ${idx + 1} of ${total}`}
            aria-hidden={idx !== currentIndex}
            className="
              relative
              h-full w-full min-w-full shrink-0
              overflow-hidden
            "
          >
            <Link
              href={slide.href}
              tabIndex={idx === currentIndex ? 0 : -1}
              className="
                absolute inset-0
                block h-full w-full
                focus-visible:outline
                focus-visible:outline-2
                focus-visible:outline-[#BF5330]
              "
            >
              <picture className="absolute inset-0 block h-full w-full">
                {/* Desktop banner */}
                <source
                  media="(min-width: 768px)"
                  srcSet={slide.desktopSrc}
                />

                {/* Original portrait banner for mobile */}
                <img
                  src={slide.portraitSrc}
                  alt={slide.alt}
                  loading={idx === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={idx === 0 ? "high" : "auto"}
                  draggable={false}
                  className="
                    absolute inset-0
                    block h-full w-full
                    object-contain object-center
                    select-none
                  "
                />
              </picture>
            </Link>
          </div>
        ))}
      </div>

      {/* Previous slide */}
      <button
        type="button"
        onClick={goToPrev}
        aria-label="Previous promotional slide"
        className="
          absolute left-2.5 sm:left-4 lg:left-6 top-1/2 z-20
          flex h-9 w-9 -translate-y-1/2
          items-center justify-center
          rounded-full border border-[#E8DFD4]/80
          bg-white/90 text-[#1A1614] shadow-md
          transition hover:bg-white hover:shadow-lg
          focus-visible:outline focus-visible:outline-2
          focus-visible:outline-[#BF5330]
          sm:h-11 sm:w-11
        "
      >
        <ChevronLeft className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      {/* Next slide */}
      <button
        type="button"
        onClick={goToNext}
        aria-label="Next promotional slide"
        className="
          absolute right-2.5 sm:right-4 lg:right-6 top-1/2 z-20
          flex h-9 w-9 -translate-y-1/2
          items-center justify-center
          rounded-full border border-[#E8DFD4]/80
          bg-white/90 text-[#1A1614] shadow-md
          transition hover:bg-white hover:shadow-lg
          focus-visible:outline focus-visible:outline-2
          focus-visible:outline-[#BF5330]
          sm:h-11 sm:w-11
        "
      >
        <ChevronRight className="h-5 w-5 sm:h-6 sm:w-6" />
      </button>

      {/* Slide indicators */}
      <div
        className="
          absolute bottom-2.5 left-1/2 z-20
          flex -translate-x-1/2 items-center gap-2
          rounded-full bg-[#1A1614]/50
          px-3 py-1.5 shadow-sm backdrop-blur-md
          sm:bottom-4
        "
        role="group"
        aria-label="Choose promotional slide"
      >
        {HERO_SLIDES.map((slide, idx) => {
          const isActive = idx === currentIndex;

          return (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to slide ${idx + 1}`}
              aria-pressed={isActive}
              onClick={() => setCurrentIndex(idx)}
              className={`
                h-2 rounded-full
                transition-all duration-300
                focus-visible:outline focus-visible:outline-2
                focus-visible:outline-white
                ${
                  isActive
                    ? "w-6 bg-[#BF5330]"
                    : "w-2 bg-white/60 hover:bg-white"
                }
              `}
            />
          );
        })}
      </div>
    </section>
  );
}
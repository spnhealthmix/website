"use client";

import React from "react";
import { usePathname } from "next/navigation";
import { Breadcrumb } from "@/components/catalogue/breadcrumb";

interface AccountHeaderProps {
  displayName: string;
}

export function AccountHeader({ displayName }: AccountHeaderProps) {
  const pathname = usePathname();

  // Determine current page context
  const isOrdersList = pathname === "/account/orders";
  const isOrderDetail = pathname.startsWith("/account/orders/");
  const isAddresses = pathname === "/account/addresses";
  const isReviews = pathname === "/account/reviews";
  const isProfile = pathname === "/account/profile" || pathname === "/account";

  // Breadcrumbs: visible only on the four main My Account pages
  const getBreadcrumbItems = () => {
    if (isOrdersList) {
      return [
        { label: "Home", href: "/" },
        { label: "My Account", href: "/account/profile" },
        { label: "My Orders" },
      ];
    }
    if (isAddresses) {
      return [
        { label: "Home", href: "/" },
        { label: "My Account", href: "/account/profile" },
        { label: "Saved Addresses" },
      ];
    }
    if (isReviews) {
      return [
        { label: "Home", href: "/" },
        { label: "My Account", href: "/account/profile" },
        { label: "My Reviews" },
      ];
    }
    if (isProfile) {
      return [
        { label: "Home", href: "/" },
        { label: "My Account", href: "/account/profile" },
        { label: "Profile" },
      ];
    }
    return null;
  };

  const breadcrumbItems = getBreadcrumbItems();

  // Heading & Subtitle
  const headingTitle = isOrdersList
    ? "My Orders"
    : isOrderDetail
    ? "Order Details"
    : isAddresses
    ? "Saved Addresses"
    : isReviews
    ? "My Reviews"
    : "Profile";

  const subtitle = isOrdersList
    ? "View your purchase history, fulfilment status, and order details."
    : isOrderDetail
    ? "Review your purchase history and order receipt."
    : isAddresses
    ? "Manage your delivery destinations for quick checkout."
    : isReviews
    ? "View and manage your product reviews, ratings, and verified purchases."
    : "Manage your personal profile, contact information, and preferences.";

  return (
    <>
      {/* Breadcrumb Navigation - strictly visible on the four My Account pages */}
      {breadcrumbItems && (
        <Breadcrumb items={breadcrumbItems} className="mb-2 sm:mb-4" />
      )}

      {/* Account Header Banner */}
      <div className="relative mb-4 sm:mb-8 overflow-hidden">
        {/* Subtle background botanical line art (Desktop/Tablet only to avoid mobile clutter) */}
        <div
          className="hidden md:block absolute right-0 -top-2 sm:-top-4 w-52 sm:w-80 lg:w-96 pointer-events-none select-none opacity-40 sm:opacity-75 z-0"
          aria-hidden="true"
        >
          <svg
            viewBox="0 0 320 140"
            fill="none"
            stroke="#D9C6AA"
            strokeWidth="1.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-full h-auto"
          >
            <path d="M 10 130 C 80 110, 160 85, 300 25" />
            <path d="M 160 85 C 200 65, 240 50, 290 18" />
            <path d="M 60 118 C 50 95, 75 80, 95 88 C 88 108, 68 115, 60 118" />
            <path d="M 115 100 C 110 75, 135 62, 155 72 C 148 95, 125 100, 115 100" />
            <path d="M 170 82 C 170 58, 195 45, 215 58 C 205 78, 182 84, 170 82" />
            <path d="M 225 60 C 230 38, 255 30, 270 42 C 258 62, 238 62, 225 60" />
            <path d="M 85 112 C 100 132, 125 130, 130 118 C 118 105, 98 108, 85 112" />
            <path d="M 145 92 C 165 112, 190 108, 192 94 C 178 85, 158 88, 145 92" />
            <path d="M 200 70 C 220 88, 242 82, 245 68 C 230 62, 212 65, 200 70" />
          </svg>
        </div>

        <div className="relative z-10 max-w-2xl">
          <h1 className="font-heading text-[26px] sm:text-[36px] lg:text-[42px] text-[#1A1614] font-normal tracking-tight leading-tight">
            {headingTitle}
          </h1>

          {/* Show personalized welcome message only on main account profile page */}
          {isProfile && (
            <p className="text-[14px] sm:text-base text-[#4A3B32] font-medium mt-1 sm:mt-1.5 flex items-center gap-1.5">
              <span>Welcome back, {displayName}</span>
              <span role="img" aria-label="waving hand">👋</span>
            </p>
          )}

          <p className="text-xs sm:text-sm text-[#786B62] font-normal mt-1 leading-relaxed break-words">
            {subtitle}
          </p>
        </div>
      </div>
    </>
  );
}

"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  User,
  ShoppingBag,
  MapPin,
  Star,
  LogOut,
  Loader2,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  {
    label: "Profile",
    href: "/account/profile",
    icon: User,
    exact: false,
  },
  {
    label: "My Orders",
    href: "/account/orders",
    icon: ShoppingBag,
    exact: false,
  },
  {
    label: "Saved Addresses",
    href: "/account/addresses",
    icon: MapPin,
    exact: false,
  },
  {
    label: "My Reviews",
    href: "/account/reviews",
    icon: Star,
    exact: false,
  },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  // Close mobile selector on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // Close mobile selector on click outside or Escape
  useEffect(() => {
    if (!mobileMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(e.target as Node)) {
        setMobileMenuOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("touchstart", handleOutsideClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("touchstart", handleOutsideClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileMenuOpen]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setMobileMenuOpen(false);
      setIsSigningOut(false);
      router.push("/");
      router.refresh();
    }
  };

  // Determine current active item
  const currentActiveItem =
    NAV_ITEMS.find((item) =>
      item.exact
        ? pathname === item.href
        : pathname === item.href || pathname.startsWith(item.href + "/")
    ) || NAV_ITEMS[0];

  const CurrentActiveIcon = currentActiveItem.icon;

  return (
    <div ref={mobileMenuRef} className="w-full relative">
      {/* Compact Selector Bar */}
      <button
        type="button"
        onClick={() => setMobileMenuOpen((prev) => !prev)}
        aria-expanded={mobileMenuOpen}
        aria-haspopup="menu"
        aria-controls="mobile-account-menu"
        className="w-full h-11 sm:h-12 bg-white rounded-xl sm:rounded-2xl border border-[#E8DFD4] px-3.5 shadow-2xs flex items-center justify-between transition-all hover:border-[#D6C7BA] cursor-pointer focus-visible:outline-2 focus-visible:outline-[#BF5330]"
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#FDF3EE] border border-[#BF5330]/20 flex items-center justify-center shrink-0 text-[#BF5330]">
            <CurrentActiveIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <span className="text-sm font-semibold text-[#1A1614] leading-tight truncate">
            {currentActiveItem.label}
          </span>
        </div>

        <div
          className={cn(
            "w-7 h-7 rounded-lg flex items-center justify-center text-[#786B62] transition-transform duration-200 shrink-0",
            mobileMenuOpen && "rotate-180 text-[#BF5330]"
          )}
        >
          <ChevronDown className="h-4 w-4" aria-hidden="true" />
        </div>
      </button>

      {/* Expandable Mobile Navigation Menu */}
      {mobileMenuOpen && (
        <div
          id="mobile-account-menu"
          role="menu"
          aria-label="Account navigation options"
          className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl border border-[#E8DFD4] shadow-[0_12px_36px_rgba(42,24,16,0.12)] p-2 z-40 space-y-1 animate-in fade-in slide-in-from-top-2 duration-150"
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  "flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-[#FDF3EE] text-[#BF5330] font-semibold border-l-[3.5px] border-[#BF5330] pl-3"
                    : "text-[#4A3B32] hover:bg-[#FAF6F1] hover:text-[#1A1614]"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-[#BF5330]" : "text-[#786B62]"
                    )}
                    aria-hidden="true"
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {isActive ? (
                  <span className="w-2 h-2 rounded-full bg-[#BF5330] shrink-0" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-[#C5B4A2] shrink-0" aria-hidden="true" />
                )}
              </Link>
            );
          })}

          <div className="border-t border-[#E8DFD4]/70 my-1" />

          {/* Mobile Sign Out Button */}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-sm font-medium text-[#4A3B32] hover:text-[#BF5330] hover:bg-[#FAF6F1] transition-colors cursor-pointer text-left disabled:opacity-60"
          >
            {isSigningOut ? (
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#BF5330]" aria-hidden="true" />
            ) : (
              <LogOut className="h-4 w-4 shrink-0 text-[#786B62]" aria-hidden="true" />
            )}
            <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
          </button>
        </div>
      )}
    </div>
  );
}

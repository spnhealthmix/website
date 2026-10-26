"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { User, ShoppingBag, MapPin, Star, LogOut, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const ACCOUNT_LINKS = [
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

export function AccountDropdown() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAnyAccountActive = pathname.startsWith("/account");

  // Close dropdown on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle outside click & escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
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
  }, [isOpen]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  // Hover handlers for desktop with anti-flicker delay
  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 180);
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen((prev) => !prev);
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Sign out error:", err);
    } finally {
      setIsOpen(false);
      setIsSigningOut(false);
      router.push("/");
      router.refresh();
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative inline-block shrink-0 flex-shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Profile Icon Trigger Button */}
      <button
        type="button"
        onClick={handleToggleClick}
        aria-label="My Account"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls="account-dropdown-menu"
        className={cn(
          "flex items-center justify-center h-9 w-9 xs:h-10 xs:w-10 rounded-full shrink-0 flex-shrink-0 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#BF5330] cursor-pointer",
          isOpen || isAnyAccountActive
            ? "bg-[#FDF3EE] text-[#BF5330]"
            : "text-[#1A1614] hover:bg-[var(--color-surface-sunken)] active:scale-95"
        )}
      >
        <User className="h-4.5 w-4.5 xs:h-5 xs:w-5" aria-hidden="true" />
      </button>

      {/* Dropdown Menu Panel */}
      <div
        id="account-dropdown-menu"
        role="menu"
        aria-label="Account menu"
        className={cn(
          "absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-24px)] bg-white border border-[#E8DFD4] rounded-2xl shadow-[0_10px_35px_rgba(42,24,16,0.12)] p-2 z-50 transition-all duration-200 origin-top-right font-[family-name:var(--font-body)]",
          isOpen
            ? "opacity-100 visible scale-100 translate-y-0"
            : "opacity-0 invisible scale-95 -translate-y-1 pointer-events-none"
        )}
      >
        {/* Dropdown Header */}
        <div className="px-3.5 py-2.5 border-b border-[#E8DFD4]/70 mb-1">
          <p className="text-[11px] font-semibold text-[#8C7E74] tracking-wider uppercase font-[family-name:var(--font-manrope)]">
            My Account
          </p>
        </div>

        {/* Navigation Items */}
        <div className="space-y-0.5">
          {ACCOUNT_LINKS.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(item.href + "/");

            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer",
                  isActive
                    ? "bg-[#FDF3EE] text-[#BF5330] font-semibold border-l-[3px] border-[#BF5330] pl-3"
                    : "text-[#4A3B32] hover:bg-[#FAF6F1] hover:text-[#BF5330]"
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-colors",
                    isActive ? "text-[#BF5330]" : "text-[#786B62]"
                  )}
                  aria-hidden="true"
                />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {/* Subtle Divider */}
        <div className="border-t border-[#E8DFD4]/70 my-1.5" />

        {/* Sign Out Action */}
        <button
          type="button"
          role="menuitem"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-[#4A3B32] hover:text-[#BF5330] hover:bg-[#FAF6F1] transition-colors cursor-pointer text-left disabled:opacity-60"
        >
          {isSigningOut ? (
            <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#BF5330]" aria-hidden="true" />
          ) : (
            <LogOut className="h-4 w-4 shrink-0 text-[#786B62]" aria-hidden="true" />
          )}
          <span>{isSigningOut ? "Signing Out..." : "Sign Out"}</span>
        </button>
      </div>
    </div>
  );
}

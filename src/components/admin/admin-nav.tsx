
"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Package,
  Tag,
  ClipboardList,
  Percent,
  Ticket,
  Star,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";

type AdminProfile = {
  id: string;
  email: string;
  name: string | null;
  role: "admin";
};

const NAV_ITEMS = [
  { href: "/admin", label: "Dashboard", exact: true, icon: LayoutGrid },
  { href: "/admin/products", label: "Products", exact: false, icon: Package },
  { href: "/admin/categories", label: "Categories", exact: false, icon: Tag },
  { href: "/admin/orders", label: "Orders", exact: false, icon: ClipboardList },
  { href: "/admin/offers", label: "Offers", exact: false, icon: Percent },
  { href: "/admin/coupons", label: "Coupons", exact: false, icon: Ticket },
  { href: "/admin/reviews", label: "Reviews", exact: false, icon: Star },
  { href: "/admin/settings", label: "Settings", exact: false, icon: Settings },
] as const;

export function AdminNav({ profile }: { profile: AdminProfile }) {
  const pathname = usePathname();
  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const initials = (profile.name || "Sai Saran")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const handleSignOut = async () => {
    setSigningOut(true);

    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/admin/login");
      router.refresh();
    } catch (err) {
      console.error("Sign out failed:", err);
      router.push("/admin/login");
    } finally {
      setSigningOut(false);
    }
  };

  const isActive = (item: (typeof NAV_ITEMS)[number]) => {
    if (item.exact) {
      return pathname === item.href;
    }

    return (
      pathname === item.href ||
      pathname.startsWith(`${item.href}/`)
    );
  };

  return (
    <>
      {/* Mobile Top Header */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between border-b border-[#E8DFD4] bg-[#FFFBF7] px-4 py-3 no-print">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-1.5 rounded-lg text-[#1A1614] hover:bg-[#FAF5EF] focus:outline-none focus:ring-2 focus:ring-[#BF5330]"
            aria-label="Toggle navigation"
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          <Link href="/admin" className="flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="SPN Health Mix"
              width={36}
              height={36}
              className="w-8 h-8 sm:w-[34px] sm:h-[34px] rounded-full object-contain"
            />

            <span className="font-[family-name:var(--font-logo)] text-xl sm:text-[21px] text-[#BF5330] leading-none font-normal tracking-tight">
              SPN Health Mix
            </span>
          </Link>
        </div>
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden no-print"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Main Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-[#FFFBF7] border-r border-[#E8DFD4] flex flex-col transition-transform duration-200 ease-in-out lg:translate-x-0 lg:static lg:h-screen lg:shrink-0 font-[family-name:var(--font-body)] no-print ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="p-5 border-b border-[#E8DFD4] flex items-center justify-between">
          <Link
            href="/admin"
            className="flex items-center gap-2.5 group min-w-0"
            onClick={() => setMobileMenuOpen(false)}
          >
            <Image
              src="/logo.png"
              alt="SPN Health Mix Emblem"
              width={36}
              height={36}
              priority
              className="w-8 h-8 sm:w-[34px] sm:h-[34px] rounded-full object-contain drop-shadow-2xs shrink-0 transition-transform duration-200 group-hover:scale-105"
            />

            <div className="min-w-0">
              <span className="font-[family-name:var(--font-logo)] block text-xl sm:text-[21px] lg:text-[18px] text-[#BF5330] leading-tight font-normal tracking-tight whitespace-nowrap">
                SPN Health Mix
              </span>

              {/* Operations Panel + Admin Badge */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9.5px] font-medium text-[#635850] tracking-[0.08em] uppercase whitespace-nowrap">
                  OPERATIONS PANEL
                </span>

                <span className="inline-flex items-center text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#BF5330] text-[#BF5330] shrink-0">
                  ADMIN
                </span>
              </div>
            </div>
          </Link>
        </div>

        {/* Navigation Links */}
        <nav
          className="flex-1 px-3.5 py-3 space-y-1 overflow-y-auto"
          aria-label="Admin Navigation"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
                aria-current={active ? "page" : undefined}
                className={`flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-[14px] transition-colors ${
                  active
                    ? "bg-[#BF5330] text-white shadow-xs font-semibold"
                    : "text-[#1A1614] hover:bg-[#FAF5EF] font-medium"
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${
                    active ? "text-white" : "text-[#635850]"
                  }`}
                />

                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer Identity & Sign Out */}
        <div className="p-4 border-t border-[#E8DFD4] bg-[#FFFBF7] space-y-3">
          {/* Admin Identity Card */}
          <div className="p-3.5 rounded-none border border-[#E8DFD4] bg-[#FBF6F0] flex items-center gap-3">
            {/* Rounded Square Initials Avatar */}
            <div className="w-11 h-11 rounded-xl bg-[#EFE7DD] border border-[#E8DFD4] flex items-center justify-center font-bold text-sm text-[#1A1614] shrink-0">
              {initials}
            </div>

            {/* Admin Profile Details */}
            <div className="flex-1 min-w-0">
              {/* Name + Verification Badge */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[13.5px] font-semibold text-[#1A1614] truncate">
                  {profile.name || "Sai Saran"}
                </span>

                <span className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-[#ECFDF5] text-[#059669] border border-[#A7F3D0] shrink-0">
                  Verified
                </span>
              </div>

              {/* Email Address */}
              <p
                className="text-[11.5px] text-[#635850] truncate leading-tight mt-1"
                title={profile.email}
              >
                {profile.email}
              </p>
            </div>
          </div>

          {/* Sign Out Action */}
          <div className="px-1 pt-0.5">
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              className="inline-flex items-center gap-2.5 text-[13.5px] font-semibold text-[#BF5330] hover:text-[#8F3E20] transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 shrink-0 text-[#BF5330]" />

              <span>
                {signingOut ? "Signing out..." : "Sign Out"}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}

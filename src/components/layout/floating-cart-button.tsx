"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { useCart } from "@/context/cart-context";
import { cn } from "@/lib/utils";

interface FloatingCartButtonProps {
  drawerOpen?: boolean;
}

export function FloatingCartButton({ drawerOpen = false }: FloatingCartButtonProps) {
  const pathname = usePathname();
  const { itemCount } = useCart();

  // Hide on cart and checkout flows to avoid obstructing form inputs and primary checkout buttons
  const isExcluded =
    pathname.startsWith("/cart") ||
    pathname.startsWith("/checkout");

  if (isExcluded || drawerOpen) {
    return null;
  }

  return (
    <aside
      aria-label="Floating shopping cart"
      className="md:hidden fixed z-40 transition-transform duration-200 pointer-events-auto"
      style={{
        right: "1rem",
        bottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))",
      }}
    >
      <Link
        href="/cart"
        prefetch={false}
        className={cn(
          "relative flex items-center justify-center w-[54px] h-[54px] rounded-full",
          "bg-[#66994D] text-white",
          "shadow-[0_6px_20px_rgba(22,101,52,0.42)] border-2 border-white/90",
          "active:scale-90 hover:scale-105 hover:bg-[#14532D]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#166534]",
          "transition-all duration-200 ease-out"
        )}
        aria-label={itemCount > 0 ? `Shopping cart, ${itemCount} items` : "Shopping cart"}
      >
        <ShoppingBag className="w-6 h-6 text-white drop-shadow-xs" aria-hidden="true" />

        {itemCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[21px] h-[21px] px-1.5 flex items-center justify-center rounded-full bg-white text-[var(--color-brand-primary)] text-[11px] font-extrabold shadow-md border border-[#E8DFD4] leading-none"
            aria-hidden="true"
          >
            {itemCount > 99 ? "99+" : itemCount}
          </span>
        )}
      </Link>
    </aside>
  );
}

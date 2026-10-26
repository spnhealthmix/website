"use client";

import { useEffect, useRef } from "react";
import { useCart } from "@/context/cart-context";

/**
 * Ensures client-side cart and navbar badge immediately synchronize
 * with the cleared authoritative server cart upon landing on or refreshing
 * the checkout success page.
 */
export function SuccessCartSync() {
  const { refreshCart } = useCart();
  const refreshedRef = useRef(false);

  useEffect(() => {
    if (!refreshedRef.current) {
      refreshedRef.current = true;
      void refreshCart();
    }
  }, [refreshCart]);

  return null;
}

"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/toast";
import type { CartLineView, CartSummary, CartView } from "@/lib/cart/cart";

interface CartContextValue {
  cart: CartView | null;
  itemCount: number;
  isLoading: boolean;
  isMutating: boolean;
  mutatingVariantIds: string[];
  isVariantMutating: (variantId?: string | null) => boolean;
  addItem: (variantId: string, quantity?: number) => Promise<boolean>;
  updateQuantity: (variantId: string, quantity: number) => Promise<boolean>;
  removeItem: (variantId: string) => Promise<boolean>;
  clearCart: () => Promise<boolean>;
  refreshCart: () => Promise<void>;
  isSignedIn: boolean;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [authState, setAuthState] = useState<{ isSignedIn: boolean; isLoaded: boolean }>({
    isSignedIn: false,
    isLoaded: false,
  });

  const [cart, setCart] = useState<CartView | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [mutatingVariantIds, setMutatingVariantIds] = useState<string[]>([]);

  // Check auth state from application session API
  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : { authenticated: false }))
      .then((data) => {
        if (active) {
          setAuthState({
            isSignedIn: Boolean(data?.authenticated),
            isLoaded: true,
          });
        }
      })
      .catch(() => {
        if (active) {
          setAuthState({ isSignedIn: false, isLoaded: true });
        }
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  // Prevent duplicate execution of post-login add parameter
  const processedAddParamRef = useRef<string | null>(null);

function parseCartResponse(data: unknown): CartView | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  if (obj.cart && typeof obj.cart === "object" && "items" in obj.cart && "summary" in obj.cart) {
    return obj.cart as CartView;
  }
  if ("items" in obj && "summary" in obj) {
    return obj as unknown as CartView;
  }
  return null;
}

  const fetchCart = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/cart", {
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
      });
      if (res.ok) {
        const data = await res.json();
        setCart(parseCartResponse(data));
      } else if (res.status === 401) {
        setCart(null);
      }
    } catch (err) {
      console.error("Failed to fetch cart:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch cart initially and whenever auth status changes
  useEffect(() => {
    if (authState.isLoaded) {
      fetchCart();
    }
  }, [fetchCart, authState.isLoaded, authState.isSignedIn]);

  const addItem = useCallback(
    async (variantId: string, quantity = 1): Promise<boolean> => {
      setMutatingVariantIds((prev) => (prev.includes(variantId) ? prev : [...prev, variantId]));
      setIsMutating(true);
      try {
        const res = await fetch("/api/cart/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variantId, quantity }),
        });


        if (res.ok) {
          const data = await res.json();
          const nextCart = parseCartResponse(data);
          setCart(nextCart);
          showToast("Added to cart", "success");
          return true;
        } else {
          const errorData = await res.json().catch(() => ({}));
          const message = errorData?.error?.message || errorData?.message || "Failed to add item to cart";
          showToast(message, "error");
          return false;
        }
      } catch (err) {
        console.error("Add item failed:", err);
        showToast("Network error. Please try again.", "error");
        return false;
      } finally {
        setMutatingVariantIds((prev) => prev.filter((id) => id !== variantId));
        setIsMutating(false);
      }
    },
    [pathname, router, searchParams, showToast]
  );

  const updateQuantity = useCallback(
    async (variantId: string, quantity: number): Promise<boolean> => {
      setMutatingVariantIds((prev) => (prev.includes(variantId) ? prev : [...prev, variantId]));
      setIsMutating(true);
      try {
        const res = await fetch(`/api/cart/items/${variantId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ quantity }),
        });

        if (res.ok) {
          const data = await res.json();
          const nextCart = parseCartResponse(data);
          setCart(nextCart);
          return true;
        } else {
          const errorData = await res.json().catch(() => ({}));
          const message = errorData?.error?.message || errorData?.message || "Failed to update quantity";
          showToast(message, "error");
          return false;
        }
      } catch (err) {
        console.error("Update quantity failed:", err);
        showToast("Network error. Please try again.", "error");
        return false;
      } finally {
        setMutatingVariantIds((prev) => prev.filter((id) => id !== variantId));
        setIsMutating(false);
      }
    },
    [showToast]
  );

  const removeItem = useCallback(
    async (variantId: string): Promise<boolean> => {
      setMutatingVariantIds((prev) => (prev.includes(variantId) ? prev : [...prev, variantId]));
      setIsMutating(true);
      try {
        const res = await fetch(`/api/cart/items/${variantId}`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
        });

        if (res.ok) {
          const data = await res.json();
          const nextCart = parseCartResponse(data);
          setCart(nextCart);
          showToast("Item removed from cart", "info");
          return true;
        } else {
          const errorData = await res.json().catch(() => ({}));
          const message = errorData?.error?.message || errorData?.message || "Failed to remove item";
          showToast(message, "error");
          return false;
        }
      } catch (err) {
        console.error("Remove item failed:", err);
        showToast("Network error. Please try again.", "error");
        return false;
      } finally {
        setMutatingVariantIds((prev) => prev.filter((id) => id !== variantId));
        setIsMutating(false);
      }
    },
    [showToast]
  );

  const clearCart = useCallback(async (): Promise<boolean> => {
    setIsMutating(true);
    try {
      const res = await fetch("/api/cart", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });

      if (res.ok) {
        const data = await res.json();
        const nextCart = parseCartResponse(data);
        setCart(nextCart);
        showToast("Cart cleared", "info");
        return true;
      } else {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData?.error?.message || errorData?.message || "Failed to clear cart";
        showToast(message, "error");
        return false;
      }
    } catch (err) {
      console.error("Clear cart failed:", err);
      showToast("Network error. Please try again.", "error");
      return false;
    } finally {
      setIsMutating(false);
    }
  }, [showToast]);

  const isVariantMutating = useCallback(
    (variantId?: string | null) => {
      if (!variantId) return false;
      return mutatingVariantIds.includes(variantId);
    },
    [mutatingVariantIds]
  );

  // Handle post-login ?add=[variantId]&qty=[quantity] recovery
  useEffect(() => {
    const addVariantId = searchParams.get("add");
    if (!addVariantId || !authState.isSignedIn) return;

    if (processedAddParamRef.current === addVariantId) return;
    processedAddParamRef.current = addVariantId;

    const rawQty = searchParams.get("qty");
    const parsedQty = rawQty ? parseInt(rawQty, 10) : 1;
    const addQty = Number.isInteger(parsedQty) && parsedQty > 0 ? parsedQty : 1;

    (async () => {
      const success = await addItem(addVariantId, addQty);
      if (success) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete("add");
        params.delete("qty");
        const cleanPath = pathname + (params.toString() ? `?${params.toString()}` : "");
        router.replace(cleanPath);
      }
    })();
  }, [searchParams, authState.isSignedIn, addItem, pathname, router]);

  const itemCount = cart?.summary.totalQuantity ?? 0;

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        isLoading,
        isMutating,
        mutatingVariantIds,
        isVariantMutating,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        refreshCart: fetchCart,
        isSignedIn: authState.isSignedIn,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}

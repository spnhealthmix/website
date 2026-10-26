import type { Metadata } from "next";
import { CartView } from "@/components/cart/cart-view";

export const metadata: Metadata = {
  title: "Shopping Cart — SPN Health Mix",
  description: "View and manage items in your SPN Health Mix shopping cart.",
  alternates: { canonical: "/cart" },
};

export default function CartPage() {
  return (
    <div className="py-8 lg:py-12">
      <div className="container-spn">

        <div className="mb-8">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl lg:text-3xl text-[var(--color-text-primary)]">
            Shopping Cart
          </h1>
        </div>

        <CartView />
      </div>
    </div>
  );
}

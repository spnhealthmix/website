import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Checkout — SPN Health Mix",
  description: "Complete your SPN Health Mix order securely.",
};

export default async function CheckoutPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/sign-in?redirect_url=/checkout");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">

      <div className="mb-8">
        <h1 className="font-heading text-3xl font-normal text-[var(--color-text-primary)]">
          Checkout
        </h1>
        <p className="mt-1 text-sm text-[var(--color-text-muted)]">
          Enter your delivery details and proceed to secure payment.
        </p>
      </div>

      <CheckoutForm />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { fetchBusinessSettings } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "Shipping Policy — SPN Health Mix",
  description: "Learn about SPN Health Mix delivery coverage, shipping rates, packaging standards, and shipment tracking.",
};

export default async function ShippingPolicyPage() {
  const settings = await fetchBusinessSettings();

  return (
    <div className="bg-[var(--color-surface)] min-h-screen py-12 md:py-16">
      <div className="container-spn max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-10 border-b border-[var(--color-border)] pb-8">
          <span className="kicker-spn">
            Fulfillment &amp; Logistics
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-[family-name:var(--font-heading)] font-normal text-[var(--color-text-primary)]">
            Shipping Policy
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-body)] leading-relaxed max-w-2xl">
            This policy outlines our parcel packaging, courier dispatch workflows, delivery coverage, and tracking procedures.
          </p>
        </div>

        {/* Content Surface */}
        <div className="bg-[var(--color-surface-raised)] rounded-[12px] border border-[var(--color-border)] p-5 sm:p-6 md:p-10 shadow-xs space-y-8 text-sm text-[var(--color-text-body)] font-[family-name:var(--font-body)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              1. Shipping Charges &amp; Rates
            </h2>
            <p>
              Shipping fees are calculated transparently during the checkout process before payment authorization.
            </p>
            <p>
              Depending on ongoing store promotions or configured shipping rules, orders exceeding the qualifying threshold may be eligible for free shipping. Any applicable delivery charge is explicitly displayed on your order summary prior to completing payment.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              2. Order Processing &amp; Dispatch
            </h2>
            <p>
              Once your payment is confirmed by our gateway, our fulfillment kitchen prepares and securely packs your items. Orders are handed over to our courier logistics partners upon packing.
            </p>
            <p>
              Orders placed on weekends or national holidays are typically processed on the subsequent operational business day.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              3. Courier Partners &amp; Tracking
            </h2>
            <p>
              We partner with recognized logistics providers to transport packages across India. As soon as your order is dispatched:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>You receive an email notification containing your assigned courier name and Air Waybill (AWB) number.</li>
              <li>A tracking link is provided so you can monitor the movement of your package on the carrier&apos;s system.</li>
              <li>You can view live status events anytime on your <Link href="/account/orders" className="text-[var(--color-brand-primary)] underline font-medium rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">My Orders</Link> page.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              4. Delivery Timelines
            </h2>
            <p>
              Transit duration varies according to your delivery destination, distance from our fulfillment facility, and local courier hub efficiency.
            </p>
            <p>
              Please note that {settings.businessName} does not guarantee unconditional delivery dates or same-day delivery windows. Unforeseen logistics factors such as adverse weather, transit strikes, or regional transit restrictions may occasionally impact courier movement.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              5. Delivery Attempts &amp; Undelivered Packages
            </h2>
            <p>
              Our courier partners generally attempt delivery up to two or three times at the destination address. If a package cannot be delivered due to an incorrect address, non-availability of the recipient, or unreachable contact numbers:
            </p>
            <ul className="list-disc pl-5 space-y-1">
              <li>The package may be held temporarily at your local carrier distribution center.</li>
              <li>If delivery fails repeatedly, the consignment is returned to our origin facility (Return to Origin - RTO).</li>
              <li>Please ensure your delivery phone number and complete address with landmark are accurately provided during checkout.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              6. Damaged or Tampered Packages
            </h2>
            <p>
              If your package arrives in a severely damaged or tampered outer box, we advise noting the condition with the delivery executive or taking a photograph before opening. Please contact our support team promptly at <a href={`mailto:${settings.supportEmail}`} className="text-[var(--color-brand-primary)] font-medium hover:underline rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">{settings.supportEmail}</a> with your order number.
            </p>
          </section>

          {/* Bottom links */}
          <div className="pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
            <Link href="/cancellation-refund-policy" className="text-xs text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">
              Read our Cancellation &amp; Refund Policy &rarr;
            </Link>
            <Link href="/account/orders" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)] transition-colors">
              Track Your Existing Orders
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

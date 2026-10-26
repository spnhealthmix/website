import type { Metadata } from "next";
import Link from "next/link";
import { fetchBusinessSettings } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "Cancellation & Refund Policy — SPN Health Mix",
  description: "Learn about order cancellation guidelines, refund processing, and replacement policies at SPN Health Mix.",
};

export default async function CancellationRefundPolicyPage() {
  const settings = await fetchBusinessSettings();

  return (
    <div className="bg-[var(--color-surface)] min-h-screen py-12 md:py-16">
      <div className="container-spn max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-10 border-b border-[var(--color-border)] pb-8">
          <span className="kicker-spn">
            Customer Support &amp; Returns
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-[family-name:var(--font-heading)] font-normal text-[var(--color-text-primary)]">
            Cancellation &amp; Refund Policy
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-body)] leading-relaxed max-w-2xl">
            We strive to provide pure, authentic traditional foods. This policy explains our cancellation eligibility, return conditions, and refund procedures.
          </p>
        </div>

        {/* Content Surface */}
        <div className="bg-[var(--color-surface-raised)] rounded-[12px] border border-[var(--color-border)] p-5 sm:p-6 md:p-10 shadow-xs space-y-8 text-sm text-[var(--color-text-body)] font-[family-name:var(--font-body)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              1. Order Cancellation Before Dispatch
            </h2>
            <p>
              You may request cancellation of your order while it is in preparation and prior to dispatch by our fulfillment team.
            </p>
            <p>
              To request a cancellation, please email our support team at <a href={`mailto:${settings.supportEmail}`} className="text-[var(--color-brand-primary)] font-medium hover:underline">{settings.supportEmail}</a> as soon as possible, citing your <strong>Order Reference Number</strong>.
            </p>
            <p>
              If your cancellation request is received and verified before the package is handed over to the courier partner, the order will be cancelled, and a full refund will be initiated back to your original payment method.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              2. Orders Already Dispatched
            </h2>
            <p>
              Once an order has been packed, handed over to our courier partner, or is in transit, the shipment cannot be intercepted or cancelled directly.
            </p>
            <p>
              Because our products are consumable food items (health mixes, freshly ground flours, and grains), open returns cannot be accepted for food safety and hygiene reasons once delivered.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              3. Damaged, Defective, or Incorrect Items
            </h2>
            <p>
              If you receive an item that is damaged in transit, spoiled, expired, or differs from what you ordered:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Please notify our team within <strong>48 hours</strong> of package delivery.</li>
              <li>Email us at <a href={`mailto:${settings.supportEmail}`} className="text-[var(--color-brand-primary)] font-medium hover:underline">{settings.supportEmail}</a> with your Order Reference Number and clear photographs of the damaged product packaging and outer delivery label.</li>
              <li>Upon review and confirmation by our support team, we will either dispatch a replacement package or process a refund for the affected item.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              4. Refund Processing &amp; Timelines
            </h2>
            <p>
              All approved refunds are initiated through our payment gateway partner, Razorpay, directly back to the original source of payment (UPI account, debit/credit card, or net banking account).
            </p>
            <div className="p-4 rounded-[8px] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-xs space-y-2">
              <p className="font-semibold text-[var(--color-text-primary)]">Important Note on Banking Turnaround:</p>
              <p className="text-[var(--color-text-body)]">
                Once a refund is processed by {settings.businessName}, the time taken for the amount to appear in your account may depend on your payment provider, issuing bank, or card network cycles.
              </p>
            </div>
            <p>
              You will receive an automated transactional email notification confirming the refund reference ID as soon as the refund is initiated by our team.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              5. Non-Refundable Circumstances
            </h2>
            <p>Refunds or replacements cannot be issued in the following circumstances:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Damage resulting from improper storage after delivery (e.g., exposure to moisture or pests after opening).</li>
              <li>Packages refused or undelivered due to repeatedly invalid or incomplete delivery addresses provided by the customer.</li>
              <li>Claims submitted without basic order details or verification photographs.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              6. Contact Support
            </h2>
            <p>
              For cancellation or refund assistance, our support team is available via email:
            </p>
            <div className="p-4 rounded-[8px] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-xs">
              <p className="font-semibold text-[var(--color-text-primary)]">{settings.businessName} Customer Support</p>
              <p className="mt-1">Email: <a href={`mailto:${settings.supportEmail}`} className="text-[var(--color-brand-primary)] font-medium hover:underline rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">{settings.supportEmail}</a></p>
            </div>
          </section>

          {/* Bottom links */}
          <div className="pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
            <Link href="/shipping-policy" className="text-xs text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">
              Read our Shipping Policy &rarr;
            </Link>
            <Link href="/terms" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)] transition-colors">
              Read Terms &amp; Conditions
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

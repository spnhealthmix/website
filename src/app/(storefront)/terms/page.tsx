import type { Metadata } from "next";
import Link from "next/link";
import { fetchBusinessSettings } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "Terms & Conditions — SPN Health Mix",
  description: "Terms and conditions governing the use of the SPN Health Mix storefront, account registration, purchases, and fulfillment.",
};

export default async function TermsPage() {
  const settings = await fetchBusinessSettings();

  return (
    <div className="bg-[var(--color-surface)] min-h-screen py-12 md:py-16">
      <div className="container-spn max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-10 border-b border-[var(--color-border)] pb-8">
          <span className="kicker-spn">
            Commercial Terms
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-[family-name:var(--font-heading)] font-normal text-[var(--color-text-primary)]">
            Terms &amp; Conditions
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-body)] leading-relaxed max-w-2xl">
            Please read these terms and conditions carefully before placing an order or using services provided by {settings.businessName}.
          </p>
        </div>

        {/* Content Surface */}
        <div className="bg-[var(--color-surface-raised)] rounded-[12px] border border-[var(--color-border)] p-5 sm:p-6 md:p-10 shadow-xs space-y-8 text-sm text-[var(--color-text-body)] font-[family-name:var(--font-body)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              1. General Website Usage
            </h2>
            <p>
              By accessing or placing an order through {settings.businessName}, you agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, please do not use our website or purchase our products.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              2. Account Registration &amp; Security
            </h2>
            <p>
              When creating an account through our authentication system, you agree to provide truthful and accurate information. You are responsible for safeguarding your login credentials and for all activities that occur under your account.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              3. Products, Pricing &amp; Availability
            </h2>
            <p>
              All prices displayed on {settings.businessName} are in Indian Rupees (INR) and are inclusive of applicable statutory taxes unless stated otherwise.
            </p>
            <p>
              We endeavor to keep product descriptions, ingredient lists, and pricing as accurate as possible. While we take care to maintain accurate inventory levels, products remain subject to stock availability. In the rare event an ordered item becomes unavailable prior to fulfillment, we will notify you and process a refund for that portion of the order.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              4. Orders &amp; Payment Processing
            </h2>
            <p>
              When you submit an order, your order represents an offer to purchase the selected items. An order is confirmed once payment authorization is successfully verified by our payment gateway partner, Razorpay.
            </p>
            <p>
              We reserve the right to cancel or decline any order in cases of detected fraud, invalid shipping addresses, or technical pricing discrepancies.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              5. Shipping, Dispatch &amp; Delivery
            </h2>
            <p>
              Confirmed orders are prepared and handed over to third-party courier partners for dispatch. Once your package is shipped, tracking details (AWB and carrier name) will be updated on your account portal.
            </p>
            <p>
              Delivery timeframes depend on courier operations, regional logistics, and the destination pincode. {settings.businessName} does not offer unconditional delivery time guarantees, as transportation can be influenced by weather, transit disruptions, or local regulations.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              6. Cancellation &amp; Refunds
            </h2>
            <p>
              Orders may be cancelled prior to dispatch by contacting support with your order reference number. Once an order has been dispatched or handed to the courier, standard cancellation is no longer possible.
            </p>
            <p>
              All approved refunds are credited back to the original source of payment through Razorpay. The exact turnaround time for the credit to reflect in your account depends on your payment provider or issuing bank. Please refer to our <Link href="/cancellation-refund-policy" className="text-[var(--color-brand-primary)] underline">Cancellation &amp; Refund Policy</Link> for detailed conditions.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              7. Customer Ratings &amp; Reviews
            </h2>
            <p>
              Customers who have purchased products may submit star ratings and reviews. All submitted reviews are subject to moderation to prevent profanity, false advertising, spam, or abusive content. We reserve the right to publish, decline, or remove content that violates community standards.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              8. Prohibited Activities
            </h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Attempt to disrupt website operations, security controls, or API endpoints.</li>
              <li>Impersonate any person or entity during checkout or account registration.</li>
              <li>Submit fraudulent payment credentials or unauthorized payment attempts.</li>
              <li>Use automated scrapers without prior authorization.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              9. Limitation of Liability
            </h2>
            <p>
              To the extent permitted under applicable law, {settings.businessName} shall not be liable for indirect, incidental, or consequential damages resulting from the use of our website, service interruptions, or delayed carrier shipments. Our liability for any confirmed claim regarding a purchased product is strictly limited to the purchase price paid for that item.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              10. Contact Information
            </h2>
            <p>
              For any questions or legal inquiries regarding these Terms and Conditions, please contact us:
            </p>
            <div className="p-4 rounded-[8px] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-xs">
              <p className="font-semibold text-[var(--color-text-primary)]">{settings.businessName}</p>
              <p className="mt-1">Email: <a href={`mailto:${settings.supportEmail}`} className="text-[var(--color-brand-primary)] font-medium hover:underline rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">{settings.supportEmail}</a></p>
            </div>
          </section>

          {/* Bottom link */}
          <div className="pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
            <Link href="/privacy-policy" className="text-xs text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">
              Read our Privacy Policy &rarr;
            </Link>
            <Link href="/" className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)] transition-colors">
              Return to Storefront
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

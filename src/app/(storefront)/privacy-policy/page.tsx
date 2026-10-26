import type { Metadata } from "next";
import Link from "next/link";
import { fetchBusinessSettings } from "@/lib/settings/service";

export const metadata: Metadata = {
  title: "Privacy Policy — SPN Health Mix",
  description: "Learn how SPN Health Mix collects, uses, and protects your personal information when using our online store.",
};

export default async function PrivacyPolicyPage() {
  const settings = await fetchBusinessSettings();

  return (
    <div className="bg-[var(--color-surface)] min-h-screen py-12 md:py-16">
      <div className="container-spn max-w-4xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="mb-10 border-b border-[var(--color-border)] pb-8">
          <span className="kicker-spn">
            Legal &amp; Data Protection
          </span>
          <h1 className="mt-2 text-3xl md:text-4xl font-[family-name:var(--font-heading)] font-normal text-[var(--color-text-primary)]">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-[var(--color-text-muted)] font-[family-name:var(--font-body)] leading-relaxed max-w-2xl">
            This Privacy Policy outlines how {settings.businessName} collects, handles, and safeguards your information when you browse our website, place orders, and interact with our services.
          </p>
        </div>

        {/* Content */}
        <div className="bg-[var(--color-surface-raised)] rounded-[12px] border border-[var(--color-border)] p-5 sm:p-6 md:p-10 shadow-xs space-y-8 text-sm text-[var(--color-text-body)] font-[family-name:var(--font-body)] leading-relaxed">
          <section className="space-y-3">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              1. Information We Collect
            </h2>
            <p>
              When you use our store, we collect only the information necessary to fulfill your orders, manage your account, and provide customer support:
            </p>
            <ul className="list-disc pl-5 space-y-2 text-[#4A3E37]">
              <li>
                <strong>Account Information:</strong> When you register or sign in, authentication and profile information (name, email address, and securely hashed passwords) are managed directly by our application and database. Passwords are never stored in plaintext.
              </li>
              <li>
                <strong>Order &amp; Delivery Details:</strong> When you complete checkout, we collect delivery recipient names, physical delivery addresses, phone numbers, and landmarks needed to fulfill and deliver your package.
              </li>
              <li>
                <strong>Order History:</strong> Authoritative records of the items purchased, quantities, timestamps, order references, and applied discounts or coupon codes.
              </li>
              <li>
                <strong>Customer Reviews:</strong> When you submit product feedback or star ratings on our storefront, your feedback and verified purchaser status are recorded and moderated for community guidelines.
              </li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              2. Payment Information &amp; Processing
            </h2>
            <p>
              All online payments on {settings.businessName} are processed securely through our authorized payment gateway partner, <strong>Razorpay</strong>.
            </p>
            <p>
              <strong>Important:</strong> {settings.businessName} does <em>not</em> collect, handle, or store your debit/credit card numbers, CVVs, expiry dates, UPI PINs, or net banking passwords on our servers. Sensitive payment details are entered directly into Razorpay&apos;s encrypted, PCI-DSS compliant interface. We only receive gateway reference IDs, transaction status confirmations, and paid amounts.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              3. How We Use Your Information
            </h2>
            <p>We use customer data strictly for legitimate operational purposes:</p>
            <ul className="list-disc pl-5 space-y-2">
              <li>Processing, verifying, and dispatching your orders.</li>
              <li>Handing over delivery details to courier partners for transportation and tracking.</li>
              <li>Sending transactional notifications regarding order confirmations, dispatch updates, and delivery alerts.</li>
              <li>Investigating customer support requests, cancellation inquiries, and refund claims.</li>
              <li>Maintaining audit records required for commercial compliance.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              4. Communications &amp; Transactional Notifications
            </h2>
            <p>
              We communicate with customers through transactional emails sent via our configured mail service (Gmail SMTP). These communications are strictly transactional and event-driven (e.g., order confirmation, payment receipt, shipment tracking, and delivery notifications).
            </p>
            <p>
              We do not run unsolicited promotional email campaigns or sell customer contact lists to third-party marketing companies.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              5. Third-Party Service Providers
            </h2>
            <p>
              To operate a secure and reliable e-commerce experience, we work with established infrastructure providers who process data strictly under their respective security commitments:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Razorpay:</strong> Payment gateway processing.</li>
              <li><strong>Logistics &amp; Courier Partners:</strong> Physical parcel dispatch, shipping label generation, and tracking.</li>
              <li><strong>Cloudflare:</strong> Edge hosting, application routing, and content delivery network.</li>
              <li><strong>Neon (PostgreSQL):</strong> Database hosting with encryption in transit and at rest.</li>
            </ul>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              6. Cookies &amp; Session Data
            </h2>
            <p>
              Our application uses essential technical cookies necessary for session management, user authentication, and shopping cart persistence. We do not use third-party behavioral advertising or tracking cookies.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              7. Data Protection &amp; Security Safeguards
            </h2>
            <p>
              We maintain reasonable technical and organizational safeguards designed to protect your personal data against unauthorized access, loss, or alteration. All web traffic between your browser and our servers is encrypted using modern Transport Layer Security (TLS/HTTPS). Internal database access is restricted using role-based controls.
            </p>
            <p>
              While we implement rigorous security measures, please note that no internet transmission or electronic storage method can be guaranteed as completely invulnerable.
            </p>
          </section>

          <section className="space-y-3 pt-6 border-t border-[var(--color-border)]">
            <h2 className="text-lg font-[family-name:var(--font-heading)] text-[var(--color-text-primary)]">
              8. Contacting Us About Privacy
            </h2>
            <p>
              If you have questions regarding your personal information, wish to update your profile details, or have questions regarding this Privacy Policy, please reach out to our team:
            </p>
            <div className="p-4 rounded-[8px] bg-[var(--color-surface-sunken)] border border-[var(--color-border)] text-xs">
              <p className="font-semibold text-[var(--color-text-primary)]">{settings.businessName} Customer Support</p>
              <p className="mt-1">Email: <a href={`mailto:${settings.supportEmail}`} className="text-[var(--color-brand-primary)] font-medium hover:underline rounded-[2px] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">{settings.supportEmail}</a></p>
            </div>
          </section>

          {/* Bottom link */}
          <div className="pt-6 border-t border-[var(--color-border)] flex flex-wrap items-center justify-between gap-3">
            <Link href="/terms" className="text-xs text-[var(--color-brand-primary)] hover:underline rounded-[4px] px-1 py-0.5 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--color-brand-primary)]">
              Read our Terms &amp; Conditions &rarr;
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

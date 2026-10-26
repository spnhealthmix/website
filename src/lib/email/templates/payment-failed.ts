import type { PaymentFailedData } from "../types";
import {
  escapeHtml,
  formatPaise,
  renderBaseEmailHtml,
} from "./base";

export function renderPaymentFailedEmail(data: PaymentFailedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Payment Could Not Be Completed: Order #${data.orderNumber} — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>We noticed that the payment attempt of <strong>${formatPaise(data.amountPaise)}</strong> for your order <strong>#${escapeHtml(data.orderNumber)}</strong> could not be completed.</p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #FEF2F2; border-radius: 8px; border: 1px solid #FECACA;">
      <div style="font-size: 13px; color: #991B1B;">
        <strong>Status:</strong> Payment Incomplete<br>
        ${
          data.failedReason
            ? `<span style="font-size: 12px; margin-top: 4px; display: inline-block;">Note: ${escapeHtml(data.failedReason)}</span>`
            : "The bank or payment gateway did not complete the transaction."
        }
      </div>
    </div>

    <p>You can retry the payment using the link below.</p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Payment for order #${data.orderNumber} was not completed. You can retry your payment below.`,
    headline: "Payment Incomplete",
    badgeText: "Payment Pending",
    badgeColor: "amber",
    contentHtml,
    ctaText: "Retry Payment",
    ctaUrl: data.retryUrl,
  });

  const text = `
SPN HEALTH MIX — PAYMENT INCOMPLETE

Dear ${data.customerName},

The payment for your order #${data.orderNumber} (${formatPaise(data.amountPaise)}) could not be completed.

Please complete your payment using the link below:

Retry payment:
${data.retryUrl}

If any amount was deducted from your account, it is typically reversed by your bank or payment provider.

Questions? Reach us at spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

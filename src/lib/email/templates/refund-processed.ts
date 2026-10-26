import type { RefundProcessedData } from "../types";
import { escapeHtml, formatPaise, renderBaseEmailHtml } from "./base";

export function renderRefundProcessedEmail(data: RefundProcessedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Refund Processed for Order #${data.orderNumber} — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>We are writing to confirm that a refund of <strong>${formatPaise(data.refundAmountPaise)}</strong> for order <strong>#${escapeHtml(data.orderNumber)}</strong> has been successfully processed.</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF; font-size: 13px;">
      <table border="0" cellpadding="4" cellspacing="0" width="100%">
        <tr>
          <td style="color: #87786E; width: 140px;">Order Reference:</td>
          <td style="font-weight: 600; color: #2B231D;">${escapeHtml(data.orderNumber)}</td>
        </tr>
        <tr>
          <td style="color: #87786E;">Refunded Amount:</td>
          <td style="font-weight: 700; color: #065F46;">${formatPaise(data.refundAmountPaise)}</td>
        </tr>
        <tr>
          <td style="color: #87786E;">Refund Date:</td>
          <td style="color: #2B231D;">${escapeHtml(data.refundedAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" }))}</td>
        </tr>
        ${
          data.razorpayPaymentId
            ? `<tr>
                <td style="color: #87786E;">Payment Reference:</td>
                <td style="font-family: monospace; font-size: 12px; color: #2B231D;">${escapeHtml(data.razorpayPaymentId)}</td>
              </tr>`
            : ""
        }
      </table>
    </div>

    <p style="font-size: 13px; color: #4A3E37; line-height: 1.5;">
      Your refund has been processed. The time taken for the amount to appear in your account may depend on your payment provider or bank.
    </p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `A refund of ${formatPaise(data.refundAmountPaise)} for order #${data.orderNumber} has been processed.`,
    headline: "Refund Processed",
    badgeText: "Refund Complete",
    badgeColor: "green",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — REFUND PROCESSED

Dear ${data.customerName},

A refund of ${formatPaise(data.refundAmountPaise)} for order #${data.orderNumber} has been processed.

Order Reference: ${data.orderNumber}
Refund Amount: ${formatPaise(data.refundAmountPaise)}
Date: ${data.refundedAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" })}
${data.razorpayPaymentId ? `Payment Reference: ${data.razorpayPaymentId}\n` : ""}Your refund has been processed. The time taken for the amount to appear in your account may depend on your payment provider or bank.

View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

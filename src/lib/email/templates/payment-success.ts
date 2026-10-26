import type { PaymentSuccessData } from "../types";
import {
  escapeHtml,
  formatPaise,
  renderBaseEmailHtml,
} from "./base";

export function renderPaymentSuccessEmail(data: PaymentSuccessData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Payment Received for Order #${data.orderNumber} — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>We have successfully received your payment of <strong>${formatPaise(data.amountPaise)}</strong> for order <strong>#${escapeHtml(data.orderNumber)}</strong>.</p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF;">
      <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="color: #87786E; width: 140px;">Order Reference:</td>
          <td style="font-weight: 600; color: #2B231D;">${escapeHtml(data.orderNumber)}</td>
        </tr>
        <tr>
          <td style="color: #87786E;">Payment Reference:</td>
          <td style="font-family: monospace; font-size: 12px; color: #2B231D;">${escapeHtml(data.razorpayPaymentId)}</td>
        </tr>
        <tr>
          <td style="color: #87786E;">Amount Paid:</td>
          <td style="font-weight: 700; color: #065F46;">${formatPaise(data.amountPaise)}</td>
        </tr>
        <tr>
          <td style="color: #87786E;">Date &amp; Time:</td>
          <td style="color: #2B231D;">${escapeHtml(data.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }))}</td>
        </tr>
      </table>
    </div>

    <p>Your payment has been securely verified. We are now processing your order for fulfillment.</p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Payment of ${formatPaise(data.amountPaise)} received for order #${data.orderNumber}.`,
    headline: "Payment Received Successfully",
    badgeText: "Payment Captured",
    badgeColor: "green",
    contentHtml,
    ctaText: "View Your Order",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — PAYMENT RECEIVED

Dear ${data.customerName},

We have received your payment of ${formatPaise(data.amountPaise)} for order #${data.orderNumber}.

Order Reference: ${data.orderNumber}
Payment ID: ${data.razorpayPaymentId}
Amount Paid: ${formatPaise(data.amountPaise)}
Date: ${data.paidAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })}

View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

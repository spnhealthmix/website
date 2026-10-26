import type { OrderCancelledData } from "../types";
import { escapeHtml, renderBaseEmailHtml } from "./base";

export function renderOrderCancelledEmail(data: OrderCancelledData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order Cancelled: #${data.orderNumber} — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Your order <strong>#${escapeHtml(data.orderNumber)}</strong> has been cancelled.</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF; font-size: 13px;">
      <strong>Order Reference:</strong> ${escapeHtml(data.orderNumber)}<br>
      <strong>Status:</strong> Cancelled<br>
      ${data.cancelReason ? `<strong>Reason:</strong> ${escapeHtml(data.cancelReason)}<br>` : ""}
      <strong>Date:</strong> ${escapeHtml(data.cancelledAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" }))}
    </div>

    ${
      data.refundPending
        ? `<div style="margin: 16px 0; padding: 14px; background-color: #ECFDF5; border-radius: 8px; border: 1px solid #A7F3D0; font-size: 13px; color: #065F46;">
            <strong>Refund Information:</strong> Because payment was captured, our accounts team has initiated a full refund back to your original payment source. You will receive a separate confirmation once processed.
          </div>`
        : `<p style="font-size: 13px; color: #87786E;">No charges were deducted from your payment method for this order.</p>`
    }

    <p style="font-size: 13px; color: #87786E;">
      If you did not request this cancellation or have any questions, please reply directly to this email.
    </p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your order #${data.orderNumber} has been cancelled.`,
    headline: "Order Cancelled",
    badgeText: "Cancelled",
    badgeColor: "neutral",
    contentHtml,
    ctaText: "View Order Status",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — ORDER CANCELLED

Dear ${data.customerName},

Your order #${data.orderNumber} has been cancelled on ${data.cancelledAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}.

${data.refundPending ? "A full refund has been initiated back to your original payment method.\n" : ""}
View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

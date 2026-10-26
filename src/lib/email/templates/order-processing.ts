import type { OrderStatusUpdateData } from "../types";
import { escapeHtml, renderBaseEmailHtml } from "./base";

export function renderOrderProcessingEmail(data: OrderStatusUpdateData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your Order #${data.orderNumber} is Processing — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Your order <strong>#${escapeHtml(data.orderNumber)}</strong> is now processing.</p>

    <div style="margin: 20px 0; padding: 14px 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF; font-size: 13px; color: #4A3E37;">
      <strong>Order Reference:</strong> ${escapeHtml(data.orderNumber)}<br>
      <strong>Current Status:</strong> Processing
    </div>

    <p>We will notify you again once your items are packed and dispatched.</p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your SPN Health Mix order #${data.orderNumber} is now processing.`,
    headline: "Order is Processing",
    badgeText: "Processing",
    badgeColor: "amber",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — ORDER PROCESSING

Dear ${data.customerName},

Your order #${data.orderNumber} is now processing.

Order Reference: ${data.orderNumber}
Status: Processing

View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

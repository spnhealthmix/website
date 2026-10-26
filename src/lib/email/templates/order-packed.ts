import type { OrderStatusUpdateData } from "../types";
import { escapeHtml, renderBaseEmailHtml } from "./base";

export function renderOrderPackedEmail(data: OrderStatusUpdateData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your Order #${data.orderNumber} is Packed & Ready — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Your order <strong>#${escapeHtml(data.orderNumber)}</strong> has been packed and is ready for dispatch.</p>

    <div style="margin: 20px 0; padding: 14px 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF; font-size: 13px; color: #4A3E37;">
      <strong>Order Reference:</strong> ${escapeHtml(data.orderNumber)}<br>
      <strong>Current Status:</strong> Packed &amp; Ready for Dispatch
    </div>

    <p>The package will be picked up by our courier partner shortly. We will send you your tracking number and courier details once dispatched.</p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your order #${data.orderNumber} has been packed and is ready for dispatch.`,
    headline: "Packed & Ready for Dispatch",
    badgeText: "Packed",
    badgeColor: "terracotta",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — ORDER PACKED

Dear ${data.customerName},

Your order #${data.orderNumber} has been packed and is ready for dispatch.

Order Reference: ${data.orderNumber}
Status: Packed

View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

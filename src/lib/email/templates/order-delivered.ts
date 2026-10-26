import type { OrderDeliveredData } from "../types";
import { escapeHtml, renderBaseEmailHtml } from "./base";

export function renderOrderDeliveredEmail(data: OrderDeliveredData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Delivered: Your SPN Health Mix Order #${data.orderNumber}`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Your order <strong>#${escapeHtml(data.orderNumber)}</strong> was delivered on <strong>${escapeHtml(data.deliveredAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" }))}</strong>.</p>

    <div style="margin: 24px 0; padding: 20px; background-color: #FAF6F2; border-radius: 12px; border: 1px solid #EDE6DF; text-align: center;">
      <h3 style="margin: 0 0 8px 0; font-size: 16px; color: #2B231D;">How Was Your Experience?</h3>
      <p style="margin: 0 0 16px 0; font-size: 13px; color: #87786E; line-height: 1.5;">
        You can share your review for the items you received in this order.
      </p>
      <a href="${data.reviewUrl}" target="_blank" style="display: inline-block; background-color: #C45935; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
        Write a Product Review
      </a>
    </div>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your order #${data.orderNumber} has been delivered.`,
    headline: "Package Delivered",
    badgeText: "Delivered",
    badgeColor: "green",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — ORDER DELIVERED

Dear ${data.customerName},

Your order #${data.orderNumber} has been delivered.

Delivered Date: ${data.deliveredAt.toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "long" })}

Share your review:
${data.reviewUrl}

View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

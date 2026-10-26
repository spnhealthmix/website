import type { OrderOutForDeliveryData } from "../types";
import { escapeHtml, renderBaseEmailHtml } from "./base";

export function renderOrderOutForDeliveryEmail(data: OrderOutForDeliveryData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Out for Delivery: Your Order #${data.orderNumber} — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Your order <strong>#${escapeHtml(data.orderNumber)}</strong> is out for delivery.</p>

    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF; font-size: 13px;">
      <strong>Order Reference:</strong> ${escapeHtml(data.orderNumber)}<br>
      <strong>Status:</strong> Out for Delivery<br>
      ${data.courierName ? `<strong>Courier:</strong> ${escapeHtml(data.courierName)}<br>` : ""}
      ${data.awb ? `<strong>AWB:</strong> ${escapeHtml(data.awb)}<br>` : ""}
      ${data.location ? `<strong>Location:</strong> ${escapeHtml(data.location)}<br>` : ""}
    </div>

    ${
      data.trackingUrl
        ? `<p style="text-align: center; margin: 20px 0 16px 0;">
            <a href="${escapeHtml(data.trackingUrl)}" target="_blank" style="display: inline-block; background-color: #C45935; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
              Track on Courier Website
            </a>
          </p>`
        : ""
    }
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your SPN Health Mix order #${data.orderNumber} is out for delivery.`,
    headline: "Out for Delivery",
    badgeText: "Out for Delivery",
    badgeColor: "amber",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — OUT FOR DELIVERY

Dear ${data.customerName},

Your order #${data.orderNumber} is out for delivery.

Order Reference: ${data.orderNumber}
Status: Out for Delivery
${data.courierName ? `Courier: ${data.courierName}\n` : ""}${data.awb ? `AWB: ${data.awb}\n` : ""}${data.location ? `Location: ${data.location}\n` : ""}${data.trackingUrl ? `Tracking: ${data.trackingUrl}\n` : ""}
View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

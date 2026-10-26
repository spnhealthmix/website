import type { OrderShippedData } from "../types";
import { escapeHtml, renderBaseEmailHtml } from "./base";

export function renderOrderShippedEmail(data: OrderShippedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Your Order #${data.orderNumber} Has Shipped — SPN Health Mix`;

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Your order <strong>#${escapeHtml(data.orderNumber)}</strong> has been shipped.</p>

    <div style="margin: 20px 0; padding: 18px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF;">
      <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #87786E; font-weight: 700; margin-bottom: 8px;">Shipping Details</div>
      <table border="0" cellpadding="4" cellspacing="0" width="100%" style="font-size: 13px;">
        <tr>
          <td style="color: #87786E; width: 120px;">Courier:</td>
          <td style="font-weight: 600; color: #2B231D;">${escapeHtml(data.courierName)}</td>
        </tr>
        <tr>
          <td style="color: #87786E;">AWB / Tracking:</td>
          <td style="font-family: monospace; font-size: 13px; font-weight: 700; color: #C45935;">${escapeHtml(data.awb)}</td>
        </tr>
      </table>
    </div>

    ${
      data.trackingUrl
        ? `<p style="text-align: center; margin: 24px 0 16px 0;">
            <a href="${escapeHtml(data.trackingUrl)}" target="_blank" style="display: inline-block; background-color: #C45935; color: #FFFFFF; font-size: 13px; font-weight: 600; text-decoration: none; padding: 10px 24px; border-radius: 6px;">
              Track on Courier Website
            </a>
          </p>`
        : ""
    }
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your order #${data.orderNumber} has shipped via ${data.courierName} (AWB: ${data.awb}).`,
    headline: "Your Order Has Shipped",
    badgeText: "Shipped",
    badgeColor: "green",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const text = `
SPN HEALTH MIX — ORDER SHIPPED

Dear ${data.customerName},

Your order #${data.orderNumber} has been shipped.

Courier: ${data.courierName}
AWB / Tracking Number: ${data.awb}
${data.trackingUrl ? `Track package: ${data.trackingUrl}\n` : ""}
View your order:
${data.orderUrl}

Contact: spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

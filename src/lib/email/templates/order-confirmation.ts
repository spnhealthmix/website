import type { OrderConfirmedData } from "../types";
import {
  escapeHtml,
  renderBaseEmailHtml,
  renderItemsHtml,
  renderItemsText,
} from "./base";

export function renderOrderConfirmationEmail(data: OrderConfirmedData): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = `Order Confirmed: ${data.orderNumber} — SPN Health Mix`;

  const address = data.shippingAddress;
  const addressLine = [
    address.line1,
    address.line2,
    address.landmark,
    `${address.city}, ${address.state} - ${address.pincode}`,
  ]
    .filter(Boolean)
    .map((s) => escapeHtml(s!))
    .join("<br>");

  const contentHtml = `
    <p>Dear <strong>${escapeHtml(data.customerName)}</strong>,</p>
    <p>Thank you for choosing SPN Health Mix! Your order <strong>#${escapeHtml(data.orderNumber)}</strong> has been successfully placed and confirmed.</p>
    
    <div style="margin: 20px 0; padding: 16px; background-color: #FAF6F2; border-radius: 8px; border: 1px solid #EDE6DF;">
      <div style="font-size: 12px; color: #87786E; text-transform: uppercase; font-weight: 600;">Delivery Address</div>
      <div style="margin-top: 4px; font-weight: 600; color: #2B231D;">${escapeHtml(address.fullName)} (Phone: ${escapeHtml(address.phone)})</div>
      <div style="margin-top: 2px; font-size: 13px; color: #4A3E37; line-height: 1.5;">${addressLine}</div>
    </div>

    ${renderItemsHtml(data.items, {
      subtotalPaise: data.subtotalPaise,
      discountPaise: data.discountPaise,
      shippingPaise: data.shippingPaise,
      totalPaise: data.totalPaise,
    })}

    <p style="margin-top: 24px;">We are preparing your order. You will receive an update as soon as your package is dispatched.</p>
  `;

  const html = renderBaseEmailHtml({
    preheader: `Your order #${data.orderNumber} has been confirmed. Thank you for your purchase from SPN Health Mix!`,
    headline: "Order Confirmed",
    badgeText: "Order Placed",
    badgeColor: "green",
    contentHtml,
    ctaText: "View Order Details",
    ctaUrl: data.orderUrl,
  });

  const textAddress = [
    address.fullName,
    `Phone: ${address.phone}`,
    address.line1,
    address.line2,
    address.landmark,
    `${address.city}, ${address.state} - ${address.pincode}`,
  ]
    .filter(Boolean)
    .join(", ");

  const text = `
SPN HEALTH MIX — ORDER CONFIRMED

Dear ${data.customerName},

Thank you for choosing SPN Health Mix! Your order #${data.orderNumber} has been successfully placed and confirmed.

Order Reference: ${data.orderNumber}
Delivery Address:
${textAddress}

${renderItemsText(data.items, {
  subtotalPaise: data.subtotalPaise,
  discountPaise: data.discountPaise,
  shippingPaise: data.shippingPaise,
  totalPaise: data.totalPaise,
})}

View your order online:
${data.orderUrl}

Need assistance? Contact spnhealthmix@gmail.com
`.trim();

  return { subject, html, text };
}

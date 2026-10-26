export function getSiteUrl(): string {
  const configured =
    process.env.SITE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.APP_ORIGINS ? process.env.APP_ORIGINS.split(",")[0].trim() : "");

  return configured ? configured.replace(/\/+$/, "") : "https://spn-foods.vercel.app";
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function formatPaise(paise: number): string {
  return `₹${(paise / 100).toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface BaseEmailTemplateOptions {
  preheader: string;
  headline: string;
  badgeText?: string;
  badgeColor?: "terracotta" | "green" | "amber" | "neutral";
  contentHtml: string;
  ctaText?: string;
  ctaUrl?: string;
}

export function renderBaseEmailHtml(options: BaseEmailTemplateOptions): string {
  const siteUrl = getSiteUrl();

  const badgeStyles = {
    terracotta: "background-color: #F8EBE6; color: #C45935; border: 1px solid #ECC484;",
    green: "background-color: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0;",
    amber: "background-color: #FFFBEB; color: #92400E; border: 1px solid #FDE68A;",
    neutral: "background-color: #F3F4F6; color: #374151; border: 1px solid #E5E7EB;",
  }[options.badgeColor || "terracotta"];

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>${escapeHtml(options.headline)}</title>
  <style type="text/css">
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    body { margin: 0; padding: 0; width: 100% !important; background-color: #FBF8F5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #2B231D; }
    @media screen and (max-width: 600px) {
      .email-container { width: 100% !important; }
      .fluid-padding { padding-left: 20px !important; padding-right: 20px !important; }
      .stack-column { display: block !important; width: 100% !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #FBF8F5;">
  <!-- Preview / Preheader text -->
  <div style="display: none; font-size: 1px; color: #FBF8F5; line-height: 1px; max-height: 0px; max-width: 0px; opacity: 0; overflow: hidden;">
    ${escapeHtml(options.preheader)}
  </div>

  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #FBF8F5;">
    <tr>
      <td align="center" style="padding: 32px 16px;">
        <!-- Container -->
        <table border="0" cellpadding="0" cellspacing="0" width="100%" class="email-container" style="max-width: 600px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #EDE6DF; overflow: hidden; box-shadow: 0 4px 12px rgba(43, 35, 29, 0.04);">
          
          <!-- Header Banner -->
          <tr>
            <td align="center" style="padding: 32px 24px 24px 24px; border-bottom: 2px solid #F6EFE9;">
              <a href="${siteUrl}" target="_blank" style="text-decoration: none;">
                <span style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 24px; font-weight: 800; color: #C45935; letter-spacing: 1px; display: inline-block;">
                  SPN HEALTH MIX
                </span>
              </a>
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #824629; margin-top: 4px; font-weight: 600;">
                Traditional Health &amp; Nutrition
              </div>
            </td>
          </tr>

          <!-- Main Content Surface -->
          <tr>
            <td class="fluid-padding" style="padding: 36px 36px 28px 36px;">
              ${
                options.badgeText
                  ? `<div style="margin-bottom: 16px;">
                      <span style="display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; ${badgeStyles}">
                        ${escapeHtml(options.badgeText)}
                      </span>
                    </div>`
                  : ""
              }

              <h1 style="margin: 0 0 16px 0; font-size: 22px; font-weight: 700; color: #2B231D; line-height: 1.3;">
                ${escapeHtml(options.headline)}
              </h1>

              <div style="font-size: 14px; line-height: 1.6; color: #4A3E37;">
                ${options.contentHtml}
              </div>

              ${
                options.ctaText && options.ctaUrl
                  ? `<div style="margin-top: 32px; text-align: center;">
                      <a href="${options.ctaUrl}" target="_blank" style="display: inline-block; background-color: #C45935; color: #FFFFFF; font-size: 14px; font-weight: 600; text-decoration: none; padding: 12px 28px; border-radius: 8px; box-shadow: 0 2px 4px rgba(196, 89, 53, 0.2);">
                        ${escapeHtml(options.ctaText)}
                      </a>
                    </div>`
                  : ""
              }
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px; background-color: #FAF6F2; border-top: 1px solid #EDE6DF; text-align: center;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: #824629; font-weight: 600;">
                SPN Health Mix
              </p>
              <p style="margin: 0 0 12px 0; font-size: 11px; color: #87786E; line-height: 1.5;">
                Need help or have questions regarding your order?<br>
                Reply directly to this email or reach us at <a href="mailto:spnhealthmix@gmail.com" style="color: #C45935; text-decoration: none; font-weight: 600;">spnhealthmix@gmail.com</a>
              </p>
              <p style="margin: 0; font-size: 10px; color: #AFA298;">
                This is a transactional notification concerning your account or order with SPN Health Mix.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Builds the HTML table and summary for order items.
 */
export function renderItemsHtml(
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    unitPricePaise: number;
    lineTotalPaise: number;
  }>,
  financials: {
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    totalPaise: number;
  },
): string {
  const rows = items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px 0; border-bottom: 1px solid #F1EAE4; font-size: 13px; color: #2B231D;">
        <strong>${escapeHtml(item.productName)}</strong><br>
        <span style="font-size: 11px; color: #87786E;">${escapeHtml(item.variantLabel)} × ${item.quantity}</span>
      </td>
      <td align="right" style="padding: 10px 0; border-bottom: 1px solid #F1EAE4; font-size: 13px; color: #2B231D; font-weight: 600; font-family: monospace;">
        ${formatPaise(item.lineTotalPaise)}
      </td>
    </tr>
  `,
    )
    .join("");

  return `
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-top: 20px; border-collapse: collapse;">
      <thead>
        <tr>
          <th align="left" style="padding-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #87786E; border-bottom: 2px solid #EDE6DF;">Item</th>
          <th align="right" style="padding-bottom: 8px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #87786E; border-bottom: 2px solid #EDE6DF;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
      <tfoot>
        <tr>
          <td style="padding-top: 12px; font-size: 12px; color: #87786E;">Subtotal</td>
          <td align="right" style="padding-top: 12px; font-size: 12px; color: #2B231D; font-family: monospace;">${formatPaise(financials.subtotalPaise)}</td>
        </tr>
        ${
          financials.discountPaise > 0
            ? `<tr>
                <td style="padding-top: 6px; font-size: 12px; color: #065F46;">Discount</td>
                <td align="right" style="padding-top: 6px; font-size: 12px; color: #065F46; font-family: monospace;">-${formatPaise(financials.discountPaise)}</td>
              </tr>`
            : ""
        }
        <tr>
          <td style="padding-top: 6px; font-size: 12px; color: #87786E;">Shipping</td>
          <td align="right" style="padding-top: 6px; font-size: 12px; color: #2B231D; font-family: monospace;">
            ${financials.shippingPaise === 0 ? "FREE" : formatPaise(financials.shippingPaise)}
          </td>
        </tr>
        <tr>
          <td style="padding-top: 10px; font-size: 15px; font-weight: 700; color: #2B231D; border-top: 2px solid #EDE6DF;">Total Paid</td>
          <td align="right" style="padding-top: 10px; font-size: 16px; font-weight: 700; color: #C45935; border-top: 2px solid #EDE6DF; font-family: monospace;">
            ${formatPaise(financials.totalPaise)}
          </td>
        </tr>
      </tfoot>
    </table>
  `;
}

/**
 * Builds the plain text items summary.
 */
export function renderItemsText(
  items: Array<{
    productName: string;
    variantLabel: string;
    quantity: number;
    lineTotalPaise: number;
  }>,
  financials: {
    subtotalPaise: number;
    discountPaise: number;
    shippingPaise: number;
    totalPaise: number;
  },
): string {
  const lines = items.map(
    (it) => `- ${it.productName} (${it.variantLabel}) x ${it.quantity} = ${formatPaise(it.lineTotalPaise)}`,
  );

  return [
    "--------------------------------------------------",
    "ORDER ITEMS",
    "--------------------------------------------------",
    ...lines,
    "--------------------------------------------------",
    `Subtotal: ${formatPaise(financials.subtotalPaise)}`,
    financials.discountPaise > 0 ? `Discount: -${formatPaise(financials.discountPaise)}` : null,
    `Shipping: ${financials.shippingPaise === 0 ? "FREE" : formatPaise(financials.shippingPaise)}`,
    `Total: ${formatPaise(financials.totalPaise)}`,
    "--------------------------------------------------",
  ]
    .filter(Boolean)
    .join("\n");
}

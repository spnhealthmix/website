/**
 * Razorpay & Svix signature checks using Web Crypto (works in Cloudflare Workers and Node).
 */
const enc = new TextEncoder();

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Compares without bailing out at the first differing character. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Webhook: HMAC-SHA256 of the RAW request body, keyed with the webhook secret. */
export async function verifyWebhookSignature(rawBody: string, signature: string | null, webhookSecret: string) {
  if (!signature || !webhookSecret) return false;
  return timingSafeEqual(await hmacSha256Hex(webhookSecret, rawBody), signature.trim().toLowerCase());
}

/**
 * Browser callback after Razorpay Checkout succeeds:
 * HMAC-SHA256 of `${razorpay_order_id}|${razorpay_payment_id}` keyed with the API key SECRET
 * (not the webhook secret). Use it for instant UI feedback only; the webhook stays authoritative.
 */
export async function verifyCheckoutSignature(
  p: { razorpayOrderId: string; razorpayPaymentId: string; signature: string },
  keySecret: string,
) {
  if (!p.signature || !keySecret) return false;
  return timingSafeEqual(await hmacSha256Hex(keySecret, `${p.razorpayOrderId}|${p.razorpayPaymentId}`), p.signature.trim().toLowerCase());
}

export type SvixVerifyParams = {
  id: string | null;
  timestamp: string | null;
  signatureHeader: string | null;
  rawBody: string;
};

export async function verifySvixSignature(
  p: SvixVerifyParams,
  secret: string,
  opts: { nowSeconds?: number; toleranceSeconds?: number } = {},
): Promise<boolean> {
  if (!p.id || !p.timestamp || !p.signatureHeader || !secret) return false;

  const tsNum = Number(p.timestamp);
  if (!Number.isFinite(tsNum)) return false;

  const nowSec = opts.nowSeconds ?? Math.floor(Date.now() / 1000);
  const tolerance = opts.toleranceSeconds ?? 300;
  if (Math.abs(nowSec - tsNum) > tolerance) return false;

  let secretKeyBytes: Uint8Array;
  if (secret.startsWith("whsec_")) {
    try {
      secretKeyBytes = base64ToBytes(secret.slice(6));
    } catch {
      secretKeyBytes = enc.encode(secret);
    }
  } else {
    secretKeyBytes = enc.encode(secret);
  }

  const key = await crypto.subtle.importKey(
    "raw",
    secretKeyBytes as unknown as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const toSign = `${p.id}.${p.timestamp}.${p.rawBody}`;
  const sigBytes = new Uint8Array(
    await crypto.subtle.sign("HMAC", key, enc.encode(toSign) as unknown as BufferSource),
  );
  const expectedBase64 = bytesToBase64(sigBytes);

  const passedSignatures = p.signatureHeader.split(" ");
  for (const item of passedSignatures) {
    const [version, signature] = item.split(",");
    if (version === "v1" && signature && timingSafeEqual(signature, expectedBase64)) {
      return true;
    }
  }

  return false;
}

export const __test = { hmacSha256Hex };

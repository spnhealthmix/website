/**
 * Minimal Razorpay client using fetch, so it runs in Cloudflare Workers
 * (the official Node SDK is not guaranteed to).
 */
export interface PaymentGateway {
  createOrder(params: {
    amountPaise: number;
    receipt: string; // max 40 chars at Razorpay; our order numbers are 15
    notes?: Record<string, string>;
  }): Promise<{ id: string }>;
  fetchPayment?(paymentId: string): Promise<{
    id: string;
    status: string;
    amount: number;
    currency: string;
    method?: string | null;
  } | null>;
}

export function razorpayGateway(
  keyId: string,
  keySecret: string,
  fetchImpl: typeof fetch = fetch,
): PaymentGateway {
  const auth = "Basic " + btoa(`${keyId}:${keySecret}`);
  return {
    async createOrder({ amountPaise, receipt, notes }) {
      const res = await fetchImpl("https://api.razorpay.com/v1/orders", {
        method: "POST",
        headers: { Authorization: auth, "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, notes, payment_capture: 1 }),
        signal: AbortSignal.timeout(10_000),
      });
      if (!res.ok) {
        // Do not log the request (auth header). Status + Razorpay's error body is enough.
        throw new Error(`Razorpay order creation failed: ${res.status} ${await res.text()}`);
      }
      const json = (await res.json()) as { id: string };
      return { id: json.id };
    },
    async fetchPayment(paymentId: string) {
      try {
        const res = await fetchImpl(`https://api.razorpay.com/v1/payments/${paymentId}`, {
          method: "GET",
          headers: { Authorization: auth },
          signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) return null;
        const json = (await res.json()) as {
          id: string;
          status: string;
          amount: number;
          currency: string;
          method?: string;
        };
        return {
          id: json.id,
          status: json.status,
          amount: json.amount,
          currency: json.currency,
          method: json.method ?? null,
        };
      } catch {
        return null;
      }
    },
  };
}

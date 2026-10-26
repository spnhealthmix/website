import { getTxDb } from "@/lib/db";
import { handleRazorpayWebhook } from "@/lib/payments/webhook";

// Webhooks must always run fresh; never cache.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // On Cloudflare (OpenNext) secrets arrive as Worker bindings. Confirm process.env exposes them in
  // your deployment; if not, read them from getCloudflareContext().env instead.
  const databaseUrl = process.env.DATABASE_URL!;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;

  return handleRazorpayWebhook(req, {
    webhookSecret,
    withDb: async (fn) => {
      const { db, close } = getTxDb(databaseUrl);
      try {
        return await fn(db);
      } finally {
        await close();
      }
    },
  });
}

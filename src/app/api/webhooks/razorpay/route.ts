import { getTxDb } from "@/lib/db";
import { handleRazorpayWebhook } from "@/lib/payments/webhook";
import { createRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { captureAppException } from "@/lib/sentry";

// Webhooks must always run fresh; never cache.
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // On Cloudflare (OpenNext) secrets arrive as Worker bindings. Confirm process.env exposes them in
  // your deployment; if not, read them from getCloudflareContext().env instead.
  const databaseUrl = process.env.DATABASE_URL!;
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
  const { logger, requestId } = createRequestLogger(req, "/api/webhooks/razorpay");

  try {
    const res = await handleRazorpayWebhook(req, {
      webhookSecret,
      log: (msg, extra) => {
        logger.info(extra ?? {}, msg);
      },
      withDb: async (fn) => {
        const { db, close } = getTxDb(databaseUrl);
        try {
          return await fn(db);
        } finally {
          await close();
        }
      },
    });

    if (!res.headers.has(REQUEST_ID_HEADER)) {
      res.headers.set(REQUEST_ID_HEADER, requestId);
    }
    return res;
  } catch (err) {
    captureAppException(err, {
      requestId,
      route: "/api/webhooks/razorpay",
      method: "POST",
    });
    logger.error({ err, requestId }, "Razorpay webhook unexpected failure");
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  }
}

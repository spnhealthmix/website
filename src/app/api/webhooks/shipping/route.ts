import { getTxDb } from "@/lib/db";
import { handleShippingWebhook } from "@/lib/shipping/webhook";
import { createRequestLogger, REQUEST_ID_HEADER } from "@/lib/logger";
import { captureAppException } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const databaseUrl = process.env.DATABASE_URL!;
  const { logger, requestId } = createRequestLogger(req, "/api/webhooks/shipping");

  try {
    const res = await handleShippingWebhook(req, {
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
      route: "/api/webhooks/shipping",
      method: "POST",
    });
    logger.error({ err, requestId }, "Shipping webhook unexpected failure");
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: {
        "Content-Type": "application/json",
        [REQUEST_ID_HEADER]: requestId,
      },
    });
  }
}

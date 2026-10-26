import { getTxDb } from "@/lib/db";
import { handleShippingWebhook } from "@/lib/shipping/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const databaseUrl = process.env.DATABASE_URL!;

  return handleShippingWebhook(req, {
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

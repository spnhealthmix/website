import { getTxDb } from "../lib/db";
import { expirePendingOrders } from "../lib/orders/expiry";

/**
 * Cloudflare Cron Trigger entry point.
 *
 * wrangler.jsonc:
 *   "triggers": { "crons": ["*\/5 * * * *"] }      // every 5 minutes
 *
 * Next.js on Workers (OpenNext) generates the worker's `fetch` handler, so add
 * `scheduled` in a small custom worker entry that re-exports it:
 *
 *   import openNext from "./.open-next/worker.js";
 *   import { handleScheduled } from "./src/worker/scheduled";
 *   export default {
 *     fetch: openNext.fetch,
 *     scheduled: (_e, env, ctx) => ctx.waitUntil(handleScheduled(env)),
 *   };
 */
export async function handleScheduled(env: { DATABASE_URL: string }) {
  const { db, close } = getTxDb(env.DATABASE_URL);
  try {
    const result = await expirePendingOrders(db);
    console.log("expirePendingOrders", result);
    return result;
  } finally {
    await close();
  }
}

import { neon, Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzleWs } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

/**
 * Configure auto-retry on fetch for serverless HTTP queries to gracefully handle
 * transient socket drops, Neon compute wakeups, and temporary network resets.
 */
if (typeof globalThis.fetch === "function" && !neonConfig.fetchFunction) {
  neonConfig.fetchFunction = async (input: RequestInfo | URL, init?: RequestInit) => {
    const maxRetries = 3;
    let attempt = 0;
    while (true) {
      try {
        return await fetch(input, init);
      } catch (err) {
        attempt++;
        if (attempt >= maxRetries) {
          throw err;
        }
        await new Promise((resolve) => setTimeout(resolve, attempt * 300));
      }
    }
  };
}

/**
 * Cloudflare Workers: read env per request, not at module load.
 * Pass `process.env.DATABASE_URL` (Node/local) or `env.DATABASE_URL` (Workers binding).
 */

/** Fast, stateless queries. Use for reads and single-statement writes. NO transactions. */
export function getDb(databaseUrl: string) {
  return drizzleHttp(neon(databaseUrl), { schema });
}

/**
 * WebSocket pool that supports transactions. Use for:
 *  - creating an order + order_items + stock decrement
 *  - webhook handling (insert webhook_events, update payment, update order)
 * Create one per request and close it when done.
 */
export function getTxDb(databaseUrl: string) {
  const pool = new Pool({ connectionString: databaseUrl });
  return { db: drizzleWs(pool, { schema }), close: () => pool.end() };
}

export type Db = ReturnType<typeof getDb>;
export * from "./schema";

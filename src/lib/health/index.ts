import { neon } from "@neondatabase/serverless";
import { drizzle as drizzleHttp } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

export const DEFAULT_READINESS_TIMEOUT_MS = 3000;

export interface DatabaseCheckerOptions {
  timeoutMs?: number;
  databaseUrl?: string;
  customExecutor?: (signal: AbortSignal) => Promise<unknown>;
}

export interface ReadinessResult {
  ready: boolean;
  checks: {
    database: "ok" | "unavailable";
  };
  durationMs: number;
}

/**
 * Resolves the readiness probe timeout in milliseconds.
 * Defaults to 3000ms; configurable via READINESS_DB_TIMEOUT_MS env var (1ms - 30000ms).
 */
export function getReadinessTimeoutMs(): number {
  const envVal = process.env.READINESS_DB_TIMEOUT_MS;
  if (envVal) {
    const parsed = parseInt(envVal, 10);
    if (!isNaN(parsed) && parsed > 0 && parsed <= 30000) {
      return parsed;
    }
  }
  return DEFAULT_READINESS_TIMEOUT_MS;
}

/**
 * Performs a lightweight database connectivity check (SELECT 1) using the existing
 * Neon/Drizzle HTTP client with strict timeout and AbortController cancellation.
 *
 * Security guarantees:
 * - Never throws or leaks raw error details, SQL errors, connection strings, or hostnames.
 * - Cancels the pending fetch request immediately on timeout.
 */
export async function checkReadiness(options: DatabaseCheckerOptions = {}): Promise<ReadinessResult> {
  const start = Date.now();
  const timeoutMs = options.timeoutMs ?? getReadinessTimeoutMs();
  const databaseUrl = options.databaseUrl ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    return {
      ready: false,
      checks: { database: "unavailable" },
      durationMs: Date.now() - start,
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    if (options.customExecutor) {
      await options.customExecutor(controller.signal);
    } else {
      const sqlClient = neon(databaseUrl, { fetchOptions: { signal: controller.signal } });
      const db = drizzleHttp(sqlClient);
      await db.execute(sql.raw("SELECT 1"));
    }

    return {
      ready: true,
      checks: { database: "ok" },
      durationMs: Date.now() - start,
    };
  } catch {
    return {
      ready: false,
      checks: { database: "unavailable" },
      durationMs: Date.now() - start,
    };
  } finally {
    clearTimeout(timer);
  }
}


import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { rateLimits } from "@/lib/db/schema";
import type { AnyDb } from "@/lib/orders/common";
import { getTxDb } from "@/lib/db";

export type RateLimitFailurePolicy = "fail_closed_503" | "memory_fallback";

export interface RateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
  db?: AnyDb;
  databaseUrl?: string;
  now?: Date;
  failurePolicy?: RateLimitFailurePolicy;
  logMeta?: { endpoint: string; scope: string };
}

export interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
  source: "database" | "memory_fallback" | "database_error";
}

/* ----------------------------- In-Memory Store ---------------------------- */

interface MemoryEntry {
  count: number;
  resetAt: number;
}

const memoryStore = new Map<string, MemoryEntry>();
const MAX_MEMORY_ENTRIES = 5000;

function pruneMemoryStore(nowMs: number) {
  if (memoryStore.size <= MAX_MEMORY_ENTRIES) return;
  for (const [k, v] of memoryStore.entries()) {
    if (v.resetAt <= nowMs) {
      memoryStore.delete(k);
    }
  }
}

/**
 * Fallback in-memory rate limiter used for offline unit tests or when configured.
 * NOTE: In multi-instance / edge worker production environments, memory-only limits
 * are isolated per instance and should NOT be used as the sole production defense.
 */
export function checkMemoryRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
  now: Date = new Date(),
): RateLimitResult {
  const nowMs = now.getTime();
  pruneMemoryStore(nowMs);

  const entry = memoryStore.get(key);
  if (!entry || entry.resetAt <= nowMs) {
    const resetAtMs = nowMs + windowSeconds * 1000;
    memoryStore.set(key, { count: 1, resetAt: resetAtMs });
    return {
      allowed: true,
      current: 1,
      limit,
      remaining: Math.max(0, limit - 1),
      resetAt: new Date(resetAtMs),
      retryAfterSeconds: windowSeconds,
      source: "memory_fallback",
    };
  }

  entry.count += 1;
  const resetDate = new Date(entry.resetAt);
  const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - nowMs) / 1000));
  const allowed = entry.count <= limit;

  return {
    allowed,
    current: entry.count,
    limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: resetDate,
    retryAfterSeconds,
    source: "memory_fallback",
  };
}

/** Reset in-memory rate limits (primarily for testing). */
export function resetMemoryRateLimits(): void {
  memoryStore.clear();
}

/* ---------------------------- IP and Identifiers -------------------------- */

const IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
const IPV6_REGEX = /^[0-9a-fA-F:]+$/;

function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  if (IPV4_REGEX.test(ip)) return true;
  return ip.includes(":") && IPV6_REGEX.test(ip);
}

/**
 * Extracts and sanitizes the client IP address.
 * Prioritizes Cloudflare's verified cf-connecting-ip, then x-real-ip, then the first IP
 * in x-forwarded-for. Falls back safely to 127.0.0.1 if missing or invalid.
 */
export function getClientIp(req: Request): string {
  const cfIp = req.headers.get("cf-connecting-ip");
  if (cfIp) {
    const trimmed = cfIp.trim();
    if (isValidIp(trimmed)) return trimmed;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp) {
    const trimmed = realIp.trim();
    if (isValidIp(trimmed)) return trimmed;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first && isValidIp(first)) return first;
  }

  return "127.0.0.1";
}

/**
 * Derives a canonical, bounded rate-limit key.
 * Hashes the raw identifier (IP or email) using SHA-256 to prevent unbounded key
 * growth in the database and avoid logging or persisting plaintext PII.
 */
export function deriveRateLimitKey(endpoint: string, scope: "ip" | "id", rawValue: string): string {
  const normalized = rawValue.trim().toLowerCase();
  const hash = createHash("sha256").update(normalized).digest("hex").slice(0, 32);
  return `rl:${endpoint}:${scope}:${hash}`;
}

/* --------------------------- Atomic DB Upsert ----------------------------- */

/**
 * Atomic rate-limit check using PostgreSQL sliding/fixed window upsert.
 *
 * Production Failure Policy:
 * In production (NODE_ENV === "production"), if the database is unavailable, the limiter
 * fails closed with status 503 instead of falling back to per-isolate memory, preventing
 * distributed multi-instance limit-bypass attacks.
 */
export async function checkRateLimit(options: RateLimitOptions): Promise<RateLimitResult> {
  const now = options.now ?? new Date();
  const windowMs = options.windowSeconds * 1000;
  const initialResetAt = new Date(now.getTime() + windowMs);

  const isProduction = process.env.NODE_ENV === "production";
  const failurePolicy: RateLimitFailurePolicy =
    options.failurePolicy ?? (isProduction ? "fail_closed_503" : "memory_fallback");

  let db = options.db;
  let shouldClose = false;

  if (!db && options.databaseUrl) {
    try {
      const tx = getTxDb(options.databaseUrl);
      db = tx.db;
      shouldClose = true;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String((err as any).code) : undefined;
      console.error("[RateLimit] Database connection failed.", {
        key: options.key,
        ...(options.logMeta ?? {}),
        ...(code ? { code } : {}),
      });

      if (failurePolicy === "fail_closed_503") {
        return {
          allowed: false,
          current: options.limit + 1,
          limit: options.limit,
          remaining: 0,
          resetAt: initialResetAt,
          retryAfterSeconds: Math.min(options.windowSeconds, 60),
          source: "database_error",
        };
      }
      return checkMemoryRateLimit(options.key, options.limit, options.windowSeconds, now);
    }
  }

  if (!db) {
    if (failurePolicy === "fail_closed_503" && isProduction) {
      return {
        allowed: false,
        current: options.limit + 1,
        limit: options.limit,
        remaining: 0,
        resetAt: initialResetAt,
        retryAfterSeconds: Math.min(options.windowSeconds, 60),
        source: "database_error",
      };
    }
    return checkMemoryRateLimit(options.key, options.limit, options.windowSeconds, now);
  }

  try {
    const [row] = await db
      .insert(rateLimits)
      .values({
        key: options.key,
        count: 1,
        resetAt: initialResetAt,
      })
      .onConflictDoUpdate({
        target: rateLimits.key,
        set: {
          count: sql`CASE WHEN ${rateLimits.resetAt} < ${now} THEN 1 ELSE ${rateLimits.count} + 1 END`,
          resetAt: sql`CASE WHEN ${rateLimits.resetAt} < ${now} THEN ${initialResetAt} ELSE ${rateLimits.resetAt} END`,
          updatedAt: now,
        },
      })
      .returning({
        count: rateLimits.count,
        resetAt: rateLimits.resetAt,
      });

    const currentCount = row.count;
    const resetDate = new Date(row.resetAt);
    const retryAfterSeconds = Math.max(1, Math.ceil((resetDate.getTime() - now.getTime()) / 1000));
    const allowed = currentCount <= options.limit;

    return {
      allowed,
      current: currentCount,
      limit: options.limit,
      remaining: Math.max(0, options.limit - currentCount),
      resetAt: resetDate,
      retryAfterSeconds,
      source: "database",
    };
  } catch (err) {
    const code = err && typeof err === "object" && "code" in err ? String((err as any).code) : undefined;
    console.error("[RateLimit] Database query failed.", {
      key: options.key,
      ...(options.logMeta ?? {}),
      ...(code ? { code } : {}),
    });

    if (failurePolicy === "fail_closed_503") {
      return {
        allowed: false,
        current: options.limit + 1,
        limit: options.limit,
        remaining: 0,
        resetAt: initialResetAt,
        retryAfterSeconds: Math.min(options.windowSeconds, 60),
        source: "database_error",
      };
    }

    return checkMemoryRateLimit(options.key, options.limit, options.windowSeconds, now);
  } finally {
    if (shouldClose && options.databaseUrl) {
      // In Neon websocket pool, connection is closed after request
    }
  }
}

/* ------------------------- High-Level Endpoint Guard ---------------------- */

export interface RateLimitEndpointOptions {
  endpoint: string;
  ipLimit: { limit: number; windowSeconds: number };
  idLimit?: { identifier: string; limit: number; windowSeconds: number };
  db?: AnyDb;
  databaseUrl?: string;
  now?: Date;
  failurePolicy?: RateLimitFailurePolicy;
}

export type RateLimitEndpointResult =
  | { allowed: true; remaining: number; resetAt: Date }
  | {
      allowed: false;
      reason: "ip_limit_exceeded" | "id_limit_exceeded" | "limiter_unavailable";
      retryAfterSeconds: number;
      resetAt: Date;
    };

export async function checkEndpointRateLimit(
  req: Request,
  options: RateLimitEndpointOptions,
): Promise<RateLimitEndpointResult> {
  const clientIp = getClientIp(req);
  const ipKey = deriveRateLimitKey(options.endpoint, "ip", clientIp);

  // 1. IP check runs first to protect database storage from unbounded identifier spam
  const ipResult = await checkRateLimit({
    key: ipKey,
    limit: options.ipLimit.limit,
    windowSeconds: options.ipLimit.windowSeconds,
    db: options.db,
    databaseUrl: options.databaseUrl,
    now: options.now,
    failurePolicy: options.failurePolicy,
    logMeta: { endpoint: options.endpoint, scope: "ip" },
  });

  if (!ipResult.allowed) {
    if (ipResult.source === "database_error") {
      return {
        allowed: false,
        reason: "limiter_unavailable",
        retryAfterSeconds: ipResult.retryAfterSeconds,
        resetAt: ipResult.resetAt,
      };
    }
    return {
      allowed: false,
      reason: "ip_limit_exceeded",
      retryAfterSeconds: ipResult.retryAfterSeconds,
      resetAt: ipResult.resetAt,
    };
  }

  // 2. Identifier check (if provided and valid)
  if (options.idLimit && options.idLimit.identifier.trim().length > 0) {
    const idKey = deriveRateLimitKey(options.endpoint, "id", options.idLimit.identifier);
    const idResult = await checkRateLimit({
      key: idKey,
      limit: options.idLimit.limit,
      windowSeconds: options.idLimit.windowSeconds,
      db: options.db,
      databaseUrl: options.databaseUrl,
      now: options.now,
      failurePolicy: options.failurePolicy,
      logMeta: { endpoint: options.endpoint, scope: "id" },
    });

    if (!idResult.allowed) {
      if (idResult.source === "database_error") {
        return {
          allowed: false,
          reason: "limiter_unavailable",
          retryAfterSeconds: idResult.retryAfterSeconds,
          resetAt: idResult.resetAt,
        };
      }
      return {
        allowed: false,
        reason: "id_limit_exceeded",
        retryAfterSeconds: idResult.retryAfterSeconds,
        resetAt: idResult.resetAt,
      };
    }

    return {
      allowed: true,
      remaining: Math.min(ipResult.remaining, idResult.remaining),
      resetAt: ipResult.resetAt < idResult.resetAt ? ipResult.resetAt : idResult.resetAt,
    };
  }

  return {
    allowed: true,
    remaining: ipResult.remaining,
    resetAt: ipResult.resetAt,
  };
}

import { ApiError } from "@/lib/api/http";

/**
 * Normalizes a list of allowed origins from a string (comma-separated) or string array.
 * Validates each URL to ensure it has a valid http/https scheme and extracts the canonical
 * lowercase origin without path, query parameters, or trailing slashes.
 */
export function normalizeAllowedOrigins(raw?: string | string[]): string[] {
  if (!raw) return [];

  const rawList = Array.isArray(raw)
    ? raw
    : raw.split(",").map((s) => s.trim());

  const result: string[] = [];

  for (const entry of rawList) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    try {
      const url = new URL(trimmed);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        console.warn(`[Security] Ignoring invalid origin protocol: ${trimmed}`);
        continue;
      }
      const canonical = url.origin.toLowerCase();
      if (!result.includes(canonical)) {
        result.push(canonical);
      }
    } catch {
      console.warn(`[Security] Ignoring malformed origin entry: ${trimmed}`);
    }
  }

  return result;
}

/**
 * Strict fail-closed origin validation for administrative and high-privilege mutations.
 *
 * Rules:
 * 1. If no allowlist is configured, fails closed with a 500 ORIGIN_CONFIG_ERROR.
 * 2. Missing Origin headers are rejected with 403 FORBIDDEN_ORIGIN.
 * 3. 'Origin: null' (opaque / sandboxed / privacy contexts) is rejected with 403 FORBIDDEN_ORIGIN.
 * 4. Malformed or unparseable Origin headers are rejected with 403 FORBIDDEN_ORIGIN.
 * 5. Origin must exactly match one of the canonical allowed origins.
 */
export function assertAdminOriginAllowed(req: Request, configuredOrigins?: string[]): void {
  const allowlist = normalizeAllowedOrigins(
    configuredOrigins && configuredOrigins.length > 0
      ? configuredOrigins
      : process.env.APP_ORIGINS || process.env.NEXT_PUBLIC_SITE_URL
  );

  if (allowlist.length === 0) {
    throw new ApiError(
      500,
      "ORIGIN_CONFIG_ERROR",
      "Administrative mutations require configured allowed origins (APP_ORIGINS).",
    );
  }

  const origin = req.headers.get("origin")?.trim();

  if (!origin || origin.toLowerCase() === "null") {
    throw new ApiError(
      403,
      "FORBIDDEN_ORIGIN",
      "Administrative mutations require a valid, non-null Origin header.",
    );
  }

  let canonicalOrigin: string;
  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      throw new Error("Invalid scheme");
    }
    canonicalOrigin = url.origin.toLowerCase();
  } catch {
    throw new ApiError(403, "FORBIDDEN_ORIGIN", "Malformed Origin header.");
  }

  if (!allowlist.includes(canonicalOrigin)) {
    throw new ApiError(403, "FORBIDDEN_ORIGIN", "Request origin not allowed.");
  }
}

/**
 * Standard CSRF defense for customer mutations.
 * If an Origin header is sent by the browser, it must match an allowed origin.
 */
export function assertCustomerOriginAllowed(req: Request, configuredOrigins?: string[]): void {
  const origin = req.headers.get("origin")?.trim();
  if (!origin) return;

  if (origin.toLowerCase() === "null") {
    throw new ApiError(403, "FORBIDDEN_ORIGIN", "Opaque null origins are not permitted for mutations.");
  }

  const allowlist = normalizeAllowedOrigins(
    configuredOrigins && configuredOrigins.length > 0
      ? configuredOrigins
      : process.env.APP_ORIGINS || process.env.NEXT_PUBLIC_SITE_URL
  );

  if (allowlist.length > 0) {
    let canonicalOrigin: string;
    try {
      const url = new URL(origin);
      if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error("Invalid scheme");
      }
      canonicalOrigin = url.origin.toLowerCase();
    } catch {
      throw new ApiError(403, "FORBIDDEN_ORIGIN", "Malformed Origin header.");
    }

    if (!allowlist.includes(canonicalOrigin)) {
      throw new ApiError(403, "FORBIDDEN_ORIGIN", "Request origin not allowed.");
    }
  }
}

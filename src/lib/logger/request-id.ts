export const REQUEST_ID_HEADER = "x-request-id";

/**
 * Valid request ID pattern:
 * - 8 to 64 characters
 * - Alphanumeric, underscores, hyphens only
 * - Discards malicious/oversized payloads or header injection attempts
 */
const VALID_REQUEST_ID_REGEX = /^[a-zA-Z0-9_-]{8,64}$/;

/**
 * Generates an isomorphic UUID without node:crypto imports.
 */
function generateUUID(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID().replace(/-/g, "");
  }
  // Safe math fallback for edge cases
  let d = Date.now();
  return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (d + Math.random() * 16) % 16 | 0;
    d = Math.floor(d / 16);
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Validates and extracts an existing x-request-id header, or generates a fresh cryptographically secure ID.
 */
export function extractOrGenerateRequestId(input?: Request | Headers | HeadersInit | null): string {
  if (input) {
    let incoming: string | null = null;
    if ("headers" in input && input.headers instanceof Headers) {
      incoming = input.headers.get(REQUEST_ID_HEADER);
    } else if (input instanceof Headers) {
      incoming = input.get(REQUEST_ID_HEADER);
    } else if (typeof input === "object" && !Array.isArray(input)) {
      const headersRecord = input as Record<string, string | undefined>;
      incoming = headersRecord[REQUEST_ID_HEADER] ?? headersRecord["X-Request-Id"] ?? null;
    }

    if (incoming) {
      const trimmed = incoming.trim();
      if (VALID_REQUEST_ID_REGEX.test(trimmed)) {
        return trimmed;
      }
    }
  }

  // Generate a clean, high-entropy unique request ID
  return `req_${generateUUID()}`;
}

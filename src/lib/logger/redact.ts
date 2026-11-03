/**
 * Sensitive data redaction for SPN Health Mix structured logging.
 * Protects PII, passwords, authentication tokens, payment secrets, and credentials.
 */

export const REDACTED_PLACEHOLDER = "[REDACTED]";

export const SENSITIVE_KEY_PATTERNS: RegExp[] = [
  /pass(word)?/i,
  /secret/i,
  /token/i,
  /auth(orization)?/i,
  /cookie/i,
  /session/i,
  /database_?url/i,
  /connection_?string/i,
  /signature/i,
  /api_?key/i,
  /card_?(number)?/i,
  /cvv/i,
  /pan/i,
  /email/i,
  /phone/i,
  /pincode/i,
  /address/i,
];

const DATABASE_URL_REGEX = /(postgres(?:ql)?:\/\/[^:]+:)([^@]+)(@)/gi;
const BEARER_AUTH_REGEX = /(Bearer\s+)[A-Za-z0-9\-._~+/]+=*/gi;
const CARD_NUMBER_REGEX = /\b(?:\d[ -]*?){13,19}\b/g;

/**
 * Redacts string-level credentials like connection strings, bearer tokens, and card numbers.
 */
export function sanitizeString(val: string): string {
  return val
    .replace(DATABASE_URL_REGEX, "$1[REDACTED]$3")
    .replace(BEARER_AUTH_REGEX, "$1[REDACTED]")
    .replace(CARD_NUMBER_REGEX, "[REDACTED_CARD]");
}

/**
 * Recursively redacts sensitive keys and values from objects, arrays, and error metadata.
 * Limits recursion depth to prevent cyclic reference stack overflows.
 */
export function redactSensitiveData<T>(input: T, depth = 0, seen = new WeakSet<object>()): T {
  if (depth > 6) return "[DEPTH_LIMIT]" as unknown as T;
  if (input === null || input === undefined) return input;

  if (typeof input === "string") {
    return sanitizeString(input) as unknown as T;
  }

  if (typeof input !== "object") {
    return input;
  }

  // Handle circular references safely
  if (seen.has(input as object)) {
    return "[CIRCULAR]" as unknown as T;
  }
  seen.add(input as object);

  if (Array.isArray(input)) {
    return input.map((item) => redactSensitiveData(item, depth + 1, seen)) as unknown as T;
  }

  if (input instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: input.name,
      message: sanitizeString(input.message),
    };
    if (input.stack) {
      errorObj.stack = sanitizeString(input.stack);
    }
    for (const key of Object.keys(input)) {
      if (key !== "name" && key !== "message" && key !== "stack") {
        if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
          errorObj[key] = REDACTED_PLACEHOLDER;
        } else {
          errorObj[key] = redactSensitiveData((input as any)[key], depth + 1, seen);
        }
      }
    }
    return errorObj as unknown as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key))) {
      result[key] = REDACTED_PLACEHOLDER;
    } else {
      result[key] = redactSensitiveData(val, depth + 1, seen);
    }
  }

  return result as unknown as T;
}


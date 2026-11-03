import * as Sentry from "@sentry/nextjs";
import { ZodError } from "zod";
import { ApiError } from "../api/http";
import { CartError } from "../cart/errors";
import { CustomerError } from "../customers/errors";
import { InvalidSignatureError } from "../customers/orders";
import { OrderError } from "../orders/common";
import { redactSensitiveData } from "../logger/redact";
import { scrubSentryBreadcrumb, scrubSentryEvent, sanitizeSentryString } from "./scrub";

export interface SentryErrorContext {
  requestId?: string;
  route?: string;
  method?: string;
  userId?: string;
  userType?: string;
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
}

/**
 * Returns true if Sentry has a valid DSN configured in the environment.
 */
export function isSentryConfigured(): boolean {
  return Boolean(process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN);
}

/**
 * Distinguishes expected operational / client errors (4xx, validation, signature)
 * from unexpected application failures (5xx, unhandled exceptions, gateway failures).
 *
 * Sentry should only be alerted for genuine failures, avoiding noisy 4xx events.
 */
export function shouldCaptureError(err: unknown): boolean {
  if (!err) return false;

  // Explicit ApiError with status < 500 is an expected client/business response
  if (err instanceof ApiError) {
    return err.status >= 500;
  }

  // Schema validation errors are expected client errors
  if (err instanceof ZodError) {
    return false;
  }

  // Domain customer errors (not found, limit reached) are expected 4xx
  if (err instanceof CustomerError) {
    return false;
  }

  // Cart errors (limits, out of stock) are expected 4xx
  if (err instanceof CartError) {
    return false;
  }

  // Invalid payment signatures (client-side or tampering) are expected 400
  if (err instanceof InvalidSignatureError) {
    return false;
  }

  // Order errors: PAYMENT_PROVIDER_ERROR is a critical operational failure (502).
  // Other order errors (price changed, out of stock) are expected client responses (409/422).
  if (err instanceof OrderError) {
    return err.code === "PAYMENT_PROVIDER_ERROR";
  }

  // All unhandled errors, unexpected exceptions, and database crashes should be captured
  return true;
}

/**
 * Captures an application exception to Sentry with correlated metadata
 * (request ID, route, user context) and strict data redaction.
 */
export function captureAppException(
  err: unknown,
  context?: SentryErrorContext,
): string | undefined {
  if (!shouldCaptureError(err)) {
    return undefined;
  }

  return Sentry.withScope((scope) => {
    if (context?.requestId) {
      scope.setTag("request_id", context.requestId);
    }
    if (context?.route) {
      scope.setTag("route", context.route);
    }
    if (context?.method) {
      scope.setTag("method", context.method);
    }
    if (context?.userId) {
      // Strictly user ID and role only; never email, phone, or PII
      scope.setUser({
        id: sanitizeSentryString(context.userId),
        user_type: context.userType,
      });
    }
    if (context?.tags) {
      for (const [tagKey, tagVal] of Object.entries(context.tags)) {
        scope.setTag(tagKey, sanitizeSentryString(tagVal));
      }
    }
    if (context?.extra) {
      scope.setExtras(redactSensitiveData(context.extra));
    }

    if (err instanceof Error) {
      return Sentry.captureException(err);
    }

    return Sentry.captureMessage(
      typeof err === "string" ? sanitizeSentryString(err) : "Unhandled Non-Error Exception",
      { level: "error" },
    );
  });
}

export { scrubSentryBreadcrumb, scrubSentryEvent, sanitizeSentryString };


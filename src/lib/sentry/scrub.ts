import { redactSensitiveData, sanitizeString as sanitizeLoggerString, SENSITIVE_KEY_PATTERNS } from "../logger/redact";

export const REDACTED_PLACEHOLDER = "[REDACTED]";

// Regex patterns for sensitive text that may appear in error messages or breadcrumb strings
const EMAIL_REGEX = /[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g;
const INDIAN_PHONE_REGEX = /(?:\+?91[\s-]?)?[6789]\d{9}\b/g;
const RZP_SECRET_REGEX = /rzp_(?:test|live)_[a-zA-Z0-9]+/gi;

/**
 * Enhanced string sanitizer that scrubs database URLs, tokens, cards, emails,
 * phone numbers, and payment provider keys from string values.
 */
export function sanitizeSentryString(val: string): string {
  if (!val) return val;
  const loggerSanitized = sanitizeLoggerString(val);
  return loggerSanitized
    .replace(EMAIL_REGEX, "[REDACTED_EMAIL]")
    .replace(INDIAN_PHONE_REGEX, "[REDACTED_PHONE]")
    .replace(RZP_SECRET_REGEX, "[REDACTED_KEY]");
}

/**
 * Scrub Sentry breadcrumbs before they are recorded.
 */
export function scrubSentryBreadcrumb(breadcrumb: any): any {
  if (!breadcrumb) return null;

  if (typeof breadcrumb.message === "string") {
    breadcrumb.message = sanitizeSentryString(breadcrumb.message);
  }

  if (typeof breadcrumb.url === "string") {
    breadcrumb.url = sanitizeSentryString(breadcrumb.url);
  }

  if (breadcrumb.data && typeof breadcrumb.data === "object") {
    breadcrumb.data = redactSensitiveData(breadcrumb.data);
  }

  return breadcrumb;
}

/**
 * Strictly scrubs Sentry events before sending to Sentry servers.
 * Removes all PII, auth tokens, cookies, raw bodies, and credentials.
 */
export function scrubSentryEvent(event: any, _hint?: any): any {
  if (!event) return null;

  // 1. Scrub Request context
  if (event.request) {
    // Unconditionally remove raw request bodies per security requirements
    delete event.request.data;

    // Redact cookies
    if (event.request.cookies) {
      event.request.cookies = REDACTED_PLACEHOLDER;
    }

    // Scrub headers
    if (event.request.headers && typeof event.request.headers === "object") {
      const sanitizedHeaders: Record<string, string> = {};
      for (const [headerKey, headerVal] of Object.entries(event.request.headers)) {
        const lowerKey = headerKey.toLowerCase();
        if (
          lowerKey === "authorization" ||
          lowerKey === "cookie" ||
          lowerKey === "set-cookie" ||
          lowerKey === "x-api-key" ||
          lowerKey === "x-razorpay-signature" ||
          SENSITIVE_KEY_PATTERNS.some((p) => p.test(lowerKey))
        ) {
          sanitizedHeaders[headerKey] = REDACTED_PLACEHOLDER;
        } else if (typeof headerVal === "string") {
          sanitizedHeaders[headerKey] = sanitizeSentryString(headerVal);
        } else {
          sanitizedHeaders[headerKey] = String(headerVal);
        }
      }
      event.request.headers = sanitizedHeaders;
    }

    // Scrub query string and URL
    if (typeof event.request.query_string === "string") {
      event.request.query_string = sanitizeSentryString(event.request.query_string);
    }
    if (typeof event.request.url === "string") {
      event.request.url = sanitizeSentryString(event.request.url);
    }
  }

  // 2. Scrub User context (never send email, phone, ip_address, or username)
  if (event.user) {
    delete event.user.email;
    delete event.user.username;
    delete event.user.ip_address;
    delete event.user.phone;

    // Ensure user ID itself does not leak email if an email was passed as identifier
    if (typeof event.user.id === "string") {
      event.user.id = sanitizeSentryString(event.user.id);
    }
  }

  // 3. Scrub Exceptions & stack frames
  if (event.exception?.values && Array.isArray(event.exception.values)) {
    for (const exc of event.exception.values) {
      if (typeof exc.value === "string") {
        exc.value = sanitizeSentryString(exc.value);
      }
      if (exc.stacktrace?.frames && Array.isArray(exc.stacktrace.frames)) {
        for (const frame of exc.stacktrace.frames) {
          if (frame.vars && typeof frame.vars === "object") {
            frame.vars = redactSensitiveData(frame.vars);
          }
        }
      }
    }
  }

  // 4. Scrub Breadcrumbs attached to the event
  if (event.breadcrumbs && Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = event.breadcrumbs.map((b: any) => scrubSentryBreadcrumb(b)).filter(Boolean);
  }

  // 5. Scrub Extra and Contexts
  if (event.extra && typeof event.extra === "object") {
    event.extra = redactSensitiveData(event.extra);
  }
  if (event.contexts && typeof event.contexts === "object") {
    event.contexts = redactSensitiveData(event.contexts);
  }

  // 6. Scrub Tags
  if (event.tags && typeof event.tags === "object") {
    const sanitizedTags: Record<string, any> = {};
    for (const [tagKey, tagVal] of Object.entries(event.tags)) {
      if (typeof tagVal === "string") {
        sanitizedTags[tagKey] = sanitizeSentryString(tagVal);
      } else {
        sanitizedTags[tagKey] = tagVal;
      }
    }
    event.tags = sanitizedTags;
  }

  return event;
}


import { describe, it, expect, vi, beforeEach } from "vitest";
import { z, ZodError } from "zod";
import type * as SentryModule from "@sentry/nextjs";

// Mock Sentry functions so Vitest can spy on ESM-frozen namespace exports
const mockScope = {
  tags: {} as Record<string, string>,
  user: null as any,
  extras: null as any,
  setTag(k: string, v: string) {
    this.tags[k] = v;
  },
  setUser(u: any) {
    this.user = u;
  },
  setExtras(e: any) {
    this.extras = e;
  },
};

const mockWithScope = vi.fn((fn: any) => fn(mockScope));
const mockCaptureException = vi.fn((err: any) => "mock-event-id");
const mockCaptureMessage = vi.fn(
  (_message: string, _captureContext?: Parameters<typeof SentryModule.captureMessage>[1]) => "mock-msg-id",
);

vi.mock("@sentry/nextjs", async (importOriginal) => {
  const actual = await importOriginal<typeof SentryModule>();
  return {
    ...actual,
    withScope: (fn: any) => mockWithScope(fn),
    captureException: (err: any) => mockCaptureException(err),
    captureMessage: (
      message: string,
      captureContext?: Parameters<typeof SentryModule.captureMessage>[1],
    ) => mockCaptureMessage(message, captureContext),
  };
});

import {
  captureAppException,
  isSentryConfigured,
  shouldCaptureError,
  scrubSentryEvent,
  scrubSentryBreadcrumb,
  sanitizeSentryString,
} from "../src/lib/sentry";
import { ApiError, toResponse } from "../src/lib/api/http";
import { CartError } from "../src/lib/cart/errors";
import { CustomerError } from "../src/lib/customers/errors";
import { InvalidSignatureError } from "../src/lib/customers/orders";
import { OrderError } from "../src/lib/orders/common";

describe("Sentry Error Monitoring (Phase 3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScope.tags = {};
    mockScope.user = null;
    mockScope.extras = null;
  });

  describe("Configuration & Graceful Operation", () => {
    it("reports configured state based on environment variables", () => {
      const origDsn = process.env.SENTRY_DSN;
      const origPublicDsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

      delete process.env.SENTRY_DSN;
      delete process.env.NEXT_PUBLIC_SENTRY_DSN;
      expect(isSentryConfigured()).toBe(false);

      process.env.SENTRY_DSN = "https://public@sentry.example.com/1";
      expect(isSentryConfigured()).toBe(true);

      if (origDsn) process.env.SENTRY_DSN = origDsn;
      else delete process.env.SENTRY_DSN;
      if (origPublicDsn) process.env.NEXT_PUBLIC_SENTRY_DSN = origPublicDsn;
      else delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    });

    it("operates gracefully when DSN is absent without throwing", () => {
      expect(() => {
        captureAppException(new Error("Test error without DSN"), {
          requestId: "req-graceful-test",
        });
      }).not.toThrow();
    });
  });

  describe("Expected Error Filtering (shouldCaptureError)", () => {
    it("does not report expected 4xx ApiErrors", () => {
      expect(shouldCaptureError(new ApiError(400, "BAD_REQUEST", "Bad request"))).toBe(false);
      expect(shouldCaptureError(new ApiError(401, "UNAUTHORIZED", "Not signed in"))).toBe(false);
      expect(shouldCaptureError(new ApiError(403, "FORBIDDEN", "Forbidden"))).toBe(false);
      expect(shouldCaptureError(new ApiError(404, "NOT_FOUND", "Not found"))).toBe(false);
      expect(shouldCaptureError(new ApiError(409, "CONFLICT", "Conflict"))).toBe(false);
      expect(shouldCaptureError(new ApiError(422, "VALIDATION", "Unprocessable"))).toBe(false);
      expect(shouldCaptureError(new ApiError(429, "RATE_LIMITED", "Too many requests"))).toBe(false);
    });

    it("reports unexpected 5xx ApiErrors", () => {
      expect(shouldCaptureError(new ApiError(500, "INTERNAL_ERROR", "Server crash"))).toBe(true);
      expect(shouldCaptureError(new ApiError(502, "BAD_GATEWAY", "Upstream failure"))).toBe(true);
      expect(shouldCaptureError(new ApiError(503, "UNAVAILABLE", "Maintenance"))).toBe(true);
    });

    it("does not report schema validation errors (ZodError)", () => {
      const schema = z.object({ name: z.string() });
      const parseResult = schema.safeParse({});
      if (!parseResult.success) {
        expect(shouldCaptureError(parseResult.error)).toBe(false);
      }
    });

    it("does not report domain CartErrors or CustomerErrors", () => {
      expect(shouldCaptureError(new CartError("QUANTITY_LIMIT", "Max 10 items"))).toBe(false);
      expect(shouldCaptureError(new CartError("INSUFFICIENT_STOCK", "Out of stock"))).toBe(false);
      expect(shouldCaptureError(new CustomerError("ADDRESS_NOT_FOUND", "Address missing"))).toBe(false);
      expect(shouldCaptureError(new CustomerError("PROFILE_NOT_FOUND", "User missing"))).toBe(false);
    });

    it("does not report invalid payment signatures (client rejection)", () => {
      expect(shouldCaptureError(new InvalidSignatureError("Signature mismatch"))).toBe(false);
    });

    it("reports OrderError PAYMENT_PROVIDER_ERROR (502) but filters ordinary business errors", () => {
      expect(shouldCaptureError(new OrderError("PAYMENT_PROVIDER_ERROR", "Gateway down"))).toBe(true);
      expect(shouldCaptureError(new OrderError("PRICE_CHANGED", "Price updated"))).toBe(false);
      expect(shouldCaptureError(new OrderError("INSUFFICIENT_STOCK", "Stock depleted"))).toBe(false);
      expect(shouldCaptureError(new OrderError("EMPTY_CART", "Cart empty"))).toBe(false);
    });

    it("reports unexpected system errors and unhandled exceptions", () => {
      expect(shouldCaptureError(new Error("Connection reset by peer"))).toBe(true);
      expect(shouldCaptureError(new TypeError("Cannot read properties of undefined"))).toBe(true);
      expect(shouldCaptureError("Unexpected failure string")).toBe(true);
      expect(shouldCaptureError(null)).toBe(false);
      expect(shouldCaptureError(undefined)).toBe(false);
    });
  });

  describe("Context and Request ID Tagging", () => {
    it("attaches request_id, route, method and sanitized user context to Sentry scope", () => {
      const err = new Error("Payment calculation failed");
      const result = captureAppException(err, {
        requestId: "req-sec-999",
        route: "/api/checkout",
        method: "POST",
        userId: "usr-profile-888",
        userType: "customer",
        extra: { orderAmount: 50000 },
        tags: { feature: "checkout" },
      });

      expect(result).toBe("mock-event-id");
      expect(mockCaptureException).toHaveBeenCalledWith(err);
      expect(mockScope.tags.request_id).toBe("req-sec-999");
      expect(mockScope.tags.route).toBe("/api/checkout");
      expect(mockScope.tags.method).toBe("POST");
      expect(mockScope.tags.feature).toBe("checkout");
      expect(mockScope.user).toEqual({
        id: "usr-profile-888",
        user_type: "customer",
      });
      expect(mockScope.extras).toEqual({
        orderAmount: 50000,
      });
    });

    it("does not attach email or phone to user context", () => {
      captureAppException(new Error("Test"), {
        userId: "profile-id-123",
        userType: "admin",
      });

      expect(mockScope.user).toEqual({
        id: "profile-id-123",
        user_type: "admin",
      });
      expect(mockScope.user.email).toBeUndefined();
      expect(mockScope.user.phone).toBeUndefined();
    });
  });

  describe("Sensitive Data Scrubbing (Privacy & Security)", () => {
    it("scrubs database URLs, bearer tokens, card numbers, emails and keys from strings", () => {
      const sensitive =
        "Failed query: postgresql://admin:superSecretPass@neon.tech/prod_db " +
        "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.token " +
        "Card 4111 1111 1111 1111 " +
        "Contact customer@example.com or +919876543210 " +
        "Key rzp_live_abcdef123456";

      const scrubbed = sanitizeSentryString(sensitive);
      expect(scrubbed).not.toContain("superSecretPass");
      expect(scrubbed).toContain("postgresql://admin:[REDACTED]@neon.tech/prod_db");
      expect(scrubbed).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9");
      expect(scrubbed).toContain("Bearer [REDACTED]");
      expect(scrubbed).not.toContain("4111 1111 1111 1111");
      expect(scrubbed).toContain("[REDACTED_CARD]");
      expect(scrubbed).not.toContain("customer@example.com");
      expect(scrubbed).toContain("[REDACTED_EMAIL]");
      expect(scrubbed).not.toContain("9876543210");
      expect(scrubbed).toContain("[REDACTED_PHONE]");
      expect(scrubbed).not.toContain("rzp_live_abcdef123456");
      expect(scrubbed).toContain("[REDACTED_KEY]");
    });

    it("scrubs Sentry event payloads completely in beforeSend", () => {
      const rawEvent = {
        event_id: "evt-001",
        request: {
          url: "https://spnhealthmix.com/api/checkout?token=secretToken",
          query_string: "token=secretToken",
          cookies: { session_token: "jwt-cookie-val" },
          data: {
            password: "userPassword123",
            creditCard: "4111111111111111",
            address: "123 Main St, Chennai",
          },
          headers: {
            authorization: "Bearer secret-jwt-token",
            cookie: "admin_session=secret",
            "x-razorpay-signature": "razorpay-secret-sig",
            "content-type": "application/json",
          },
        },
        user: {
          id: "usr_123",
          email: "victim@example.com",
          username: "victim",
          ip_address: "192.168.1.1",
          phone: "9876543210",
        },
        exception: {
          values: [
            {
              type: "DatabaseError",
              value: "Failed connecting to postgresql://usr:pass123@ep-cool.neon.tech/db for user victim@example.com",
              stacktrace: {
                frames: [
                  {
                    filename: "db.ts",
                    vars: {
                      dbPassword: "cleartextPass",
                      userPhone: "9876543210",
                    },
                  },
                ],
              },
            },
          ],
        },
        breadcrumbs: [
          {
            message: "User logged in with customer@example.com",
            data: {
              authToken: "secretTokenVal",
              shippingAddress: "45 Anna Nagar, Chennai",
            },
          },
        ],
        extra: {
          userPassword: "leakedPassword",
          webhookSecret: "whsec_abcdef",
          pincode: "600001",
        },
        tags: {
          userEmail: "leak@example.com",
        },
      };

      const scrubbed = scrubSentryEvent(rawEvent);

      // Raw request body must be deleted unconditionally
      expect(scrubbed.request.data).toBeUndefined();

      // Cookies must be redacted
      expect(scrubbed.request.cookies).toBe("[REDACTED]");

      // Sensitive headers must be redacted
      expect(scrubbed.request.headers.authorization).toBe("[REDACTED]");
      expect(scrubbed.request.headers.cookie).toBe("[REDACTED]");
      expect(scrubbed.request.headers["x-razorpay-signature"]).toBe("[REDACTED]");
      expect(scrubbed.request.headers["content-type"]).toBe("application/json");

      // User PII must be completely stripped
      expect(scrubbed.user.email).toBeUndefined();
      expect(scrubbed.user.username).toBeUndefined();
      expect(scrubbed.user.ip_address).toBeUndefined();
      expect(scrubbed.user.phone).toBeUndefined();
      expect(scrubbed.user.id).toBe("usr_123");

      // Exception message must be sanitized
      expect(scrubbed.exception.values[0].value).not.toContain("pass123");
      expect(scrubbed.exception.values[0].value).not.toContain("victim@example.com");

      // Stack frame variables must be redacted
      expect(scrubbed.exception.values[0].stacktrace.frames[0].vars.dbPassword).toBe("[REDACTED]");
      expect(scrubbed.exception.values[0].stacktrace.frames[0].vars.userPhone).toBe("[REDACTED]");

      // Breadcrumbs must be sanitized
      expect(scrubbed.breadcrumbs[0].message).not.toContain("customer@example.com");
      expect(scrubbed.breadcrumbs[0].message).toContain("[REDACTED_EMAIL]");
      expect(scrubbed.breadcrumbs[0].data.authToken).toBe("[REDACTED]");
      expect(scrubbed.breadcrumbs[0].data.shippingAddress).toBe("[REDACTED]");

      // Extra and Tags must be redacted
      expect(scrubbed.extra.userPassword).toBe("[REDACTED]");
      expect(scrubbed.extra.webhookSecret).toBe("[REDACTED]");
      expect(scrubbed.extra.pincode).toBe("[REDACTED]");
      expect(scrubbed.tags.userEmail).toBe("[REDACTED_EMAIL]");
    });

    it("scrubs breadcrumb messages and data in scrubSentryBreadcrumb", () => {
      const breadcrumb = {
        category: "auth",
        message: "Attempted login for admin@spnhealthmix.com",
        data: {
          sessionCookie: "admin_token_xyz",
        },
      };

      const result = scrubSentryBreadcrumb(breadcrumb);
      expect(result.message).not.toContain("admin@spnhealthmix.com");
      expect(result.message).toContain("[REDACTED_EMAIL]");
      expect(result.data.sessionCookie).toBe("[REDACTED]");
    });
  });

  describe("Integration with toResponse()", () => {
    it("automatically captures unhandled 500 errors in Sentry and preserves response", () => {
      const err = new Error("Unexpected database disconnection");
      const res = toResponse(err, undefined, "req-corr-500");

      expect(res.status).toBe(500);
      expect(res.headers.get("x-request-id")).toBe("req-corr-500");
      expect(mockCaptureException).toHaveBeenCalledWith(err);
    });

    it("does not report expected 404 or 422 errors in toResponse()", () => {
      const notFoundRes = toResponse(
        new ApiError(404, "NOT_FOUND", "Resource not found"),
        undefined,
        "req-corr-404",
      );
      expect(notFoundRes.status).toBe(404);
      expect(mockCaptureException).not.toHaveBeenCalled();

      const validationRes = toResponse(
        new CartError("CART_LINE_LIMIT", "Too many items"),
        undefined,
        "req-corr-409",
      );
      expect(validationRes.status).toBe(409);
      expect(mockCaptureException).not.toHaveBeenCalled();
    });

    it("captures 502 PAYMENT_PROVIDER_ERROR in toResponse()", () => {
      const err = new OrderError("PAYMENT_PROVIDER_ERROR", "Razorpay timed out");
      const res = toResponse(err, undefined, "req-corr-502");

      expect(res.status).toBe(502);
      expect(res.headers.get("x-request-id")).toBe("req-corr-502");
      expect(mockCaptureException).toHaveBeenCalledWith(err);
    });
  });
});

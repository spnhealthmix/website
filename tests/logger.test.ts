import { describe, it, expect } from "vitest";
import { Writable } from "node:stream";
import {
  extractOrGenerateRequestId,
  REQUEST_ID_HEADER,
  redactSensitiveData,
  sanitizeString,
  createRequestLogger,
  logError,
  createPinoInstance,
  PinoStructuredLogger,
} from "../src/lib/logger";

describe("SPN Health Mix – Phase 2: Structured Logging", () => {
  describe("Request ID Generation and Validation", () => {
    it("generates a new high-entropy request ID when missing", () => {
      const id1 = extractOrGenerateRequestId();
      const id2 = extractOrGenerateRequestId();
      expect(id1).toMatch(/^req_[a-f0-9]{32}$/);
      expect(id2).toMatch(/^req_[a-f0-9]{32}$/);
      expect(id1).not.toBe(id2);
    });

    it("accepts a valid incoming x-request-id header", () => {
      const incomingId = "client-trace-12345_abc-XYZ";
      const headers = new Headers({ [REQUEST_ID_HEADER]: incomingId });
      const req = new Request("https://example.com/api/test", { headers });
      expect(extractOrGenerateRequestId(req)).toBe(incomingId);
    });

    it("rejects and regenerates an invalid or malicious incoming request ID", () => {
      // Too short (< 8 chars)
      const shortHeaders = new Headers({ [REQUEST_ID_HEADER]: "short" });
      expect(extractOrGenerateRequestId(shortHeaders)).toMatch(/^req_[a-f0-9]{32}$/);

      // Header injection attempt / illegal characters from raw object
      const injectionHeaders = { [REQUEST_ID_HEADER]: "invalid\r\nHeader-Injection: 1" };
      expect(extractOrGenerateRequestId(injectionHeaders)).toMatch(/^req_[a-f0-9]{32}$/);

      // Oversized (> 64 chars)
      const longHeaders = new Headers({ [REQUEST_ID_HEADER]: "a".repeat(70) });
      expect(extractOrGenerateRequestId(longHeaders)).toMatch(/^req_[a-f0-9]{32}$/);
    });
  });

  describe("Sensitive Data Redaction & Sanitization", () => {
    it("redacts passwords, tokens, cookies, secrets, and session info", () => {
      const sensitivePayload = {
        email: "customer@example.com",
        phone: "9876543210",
        password: "SuperSecretPassword123!",
        confirmPassword: "SuperSecretPassword123!",
        nested: {
          sessionToken: "session_token_xyz_987",
          cookie: "spn_session=abc.def.ghi",
          apiKey: "rzp_live_secret_key_12345",
          safeProperty: "this-is-public",
        },
      };

      const redacted = redactSensitiveData(sensitivePayload) as any;
      expect(redacted.password).toBe("[REDACTED]");
      expect(redacted.confirmPassword).toBe("[REDACTED]");
      expect(redacted.email).toBe("[REDACTED]");
      expect(redacted.phone).toBe("[REDACTED]");
      expect(redacted.nested.sessionToken).toBe("[REDACTED]");
      expect(redacted.nested.cookie).toBe("[REDACTED]");
      expect(redacted.nested.apiKey).toBe("[REDACTED]");
      expect(redacted.nested.safeProperty).toBe("this-is-public");
    });

    it("sanitizes database connection URLs in strings", () => {
      const url = "postgresql://neondb_owner:npg_SecretPass123@ep-cool-endpoint.aws.neon.tech/neondb?sslmode=require";
      const sanitized = sanitizeString(url);
      expect(sanitized).not.toContain("npg_SecretPass123");
      expect(sanitized).toContain("postgresql://neondb_owner:[REDACTED]@ep-cool-endpoint.aws.neon.tech/neondb?sslmode=require");
    });

    it("sanitizes bearer authentication tokens in strings", () => {
      const header = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
      const sanitized = sanitizeString(header);
      expect(sanitized).toBe("Bearer [REDACTED]");
    });

    it("sanitizes credit card patterns in strings", () => {
      const raw = "Payment with card 4111 2222 3333 4444 completed";
      const sanitized = sanitizeString(raw);
      expect(sanitized).toBe("Payment with card [REDACTED_CARD] completed");
    });

    it("safely handles circular references and depth limits", () => {
      const circularObj: any = { name: "test" };
      circularObj.self = circularObj;

      const result = redactSensitiveData(circularObj) as any;
      expect(result.name).toBe("test");
      expect(result.self).toBe("[CIRCULAR]");
    });
  });

  describe("JSON Output Structure, Log Levels, and Context", () => {
    it("emits valid JSON logs with ISO 8601 timestamps and request correlation context", () => {
      const logs: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          logs.push(chunk.toString());
          callback();
        },
      });

      const pino = createPinoInstance(stream);
      const customLogger = new PinoStructuredLogger(pino);

      const req = new Request("https://spnhealthmix.in/api/checkout", {
        method: "POST",
        headers: { [REQUEST_ID_HEADER]: "client-req-99999" },
      });

      const { logger, requestId } = createRequestLogger(
        req,
        "/api/checkout",
        { userId: "usr_uuid_12345", userRole: "customer" },
        customLogger,
      );

      logger.info({ durationMs: 42 }, "Checkout completed successfully");

      expect(requestId).toBe("client-req-99999");
      expect(logs.length).toBe(1);

      const parsed = JSON.parse(logs[0]);
      expect(parsed.level).toBe("info");
      expect(parsed.message).toBe("Checkout completed successfully");
      expect(parsed.requestId).toBe("client-req-99999");
      expect(parsed.userId).toBe("usr_uuid_12345");
      expect(parsed.userRole).toBe("customer");
      expect(parsed.route).toBe("/api/checkout");
      expect(parsed.method).toBe("POST");
      expect(parsed.durationMs).toBe(42);
      expect(new Date(parsed.time).toISOString()).toBe(parsed.time);
    });

    it("safely captures server-side errors and redacts credentials in stack traces", () => {
      const logs: string[] = [];
      const stream = new Writable({
        write(chunk, _encoding, callback) {
          logs.push(chunk.toString());
          callback();
        },
      });

      const pino = createPinoInstance(stream);
      const customLogger = new PinoStructuredLogger(pino);

      const err = new Error("Database timeout on connection postgresql://user:secretpassword@neon.tech/db");
      const { logger } = createRequestLogger(null, "/api/me", {}, customLogger);

      logError(logger, err, "Failed to load customer profile", {
        userId: "usr_123",
      });

      expect(logs.length).toBe(1);
      const parsed = JSON.parse(logs[0]);
      expect(parsed.level).toBe("error");
      expect(parsed.message).toBe("Failed to load customer profile");
      expect(parsed.errorName).toBe("Error");
      expect(parsed.errorMessage).toContain("postgresql://user:[REDACTED]@neon.tech/db");
      expect(parsed.errorMessage).not.toContain("secretpassword");
      expect(parsed.stack).toBeDefined();
      expect(parsed.stack).not.toContain("secretpassword");
    });
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import {
  checkMemoryRateLimit,
  deriveRateLimitKey,
  getClientIp,
  resetMemoryRateLimits,
  checkRateLimit,
  checkEndpointRateLimit,
} from "../src/lib/security/rate-limit";

describe("SPN-SEC-003: Rate Limiting & Abuse Controls", () => {
  beforeEach(() => {
    resetMemoryRateLimits();
  });

  describe("Client IP extraction & proxy header precedence", () => {
    it("prioritizes cf-connecting-ip from Cloudflare edge", () => {
      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: {
          "cf-connecting-ip": "203.0.113.195",
          "x-real-ip": "198.51.100.1",
          "x-forwarded-for": "192.0.2.1, 10.0.0.1",
        },
      });
      expect(getClientIp(req)).toBe("203.0.113.195");
    });

    it("falls back to x-real-ip when cf-connecting-ip is absent", () => {
      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: {
          "x-real-ip": "198.51.100.22",
          "x-forwarded-for": "192.0.2.1",
        },
      });
      expect(getClientIp(req)).toBe("198.51.100.22");
    });

    it("extracts and sanitizes the first IP in x-forwarded-for", () => {
      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: {
          "x-forwarded-for": "  203.0.113.50 , 10.0.0.1, 192.168.1.1",
        },
      });
      expect(getClientIp(req)).toBe("203.0.113.50");
    });

    it("handles valid IPv6 addresses correctly", () => {
      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: {
          "cf-connecting-ip": "2001:db8:85a3::8a2e:370:7334",
        },
      });
      expect(getClientIp(req)).toBe("2001:db8:85a3::8a2e:370:7334");
    });

    it("falls back safely to 127.0.0.1 when headers are missing or malformed", () => {
      const reqMissing = new Request("https://spnhealthmix.in/api/auth/login");
      expect(getClientIp(reqMissing)).toBe("127.0.0.1");

      const reqMalformed = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: {
          "x-forwarded-for": "malformed_ip_injection_attempt",
        },
      });
      expect(getClientIp(reqMalformed)).toBe("127.0.0.1");
    });
  });

  describe("Identifier normalization & bounded key generation", () => {
    it("normalizes casing and whitespace deterministically", () => {
      const key1 = deriveRateLimitKey("login", "id", "  User@Example.COM ");
      const key2 = deriveRateLimitKey("login", "id", "user@example.com");
      expect(key1).toBe(key2);
    });

    it("produces fixed-length keys regardless of input identifier length", () => {
      const longInput = "a".repeat(500) + "@domain.com";
      const key = deriveRateLimitKey("login", "id", longInput);
      expect(key.length).toBeLessThan(60);
      expect(key.startsWith("rl:login:id:")).toBe(true);
    });

    it("never includes plaintext email or IP in key hash to protect PII", () => {
      const email = "sensitive.customer@example.com";
      const key = deriveRateLimitKey("login", "id", email);
      expect(key).not.toContain("sensitive.customer");
      expect(key).not.toContain("@example.com");
    });
  });

  describe("Rate limiter window and counter enforcement", () => {
    it("allows requests up to the defined limit and decrements remaining", () => {
      const now = new Date("2026-10-27T12:00:00Z");
      const key = "test:user:1";

      const r1 = checkMemoryRateLimit(key, 3, 60, now);
      expect(r1.allowed).toBe(true);
      expect(r1.remaining).toBe(2);
      expect(r1.current).toBe(1);

      const r2 = checkMemoryRateLimit(key, 3, 60, now);
      expect(r2.allowed).toBe(true);
      expect(r2.remaining).toBe(1);
      expect(r2.current).toBe(2);

      const r3 = checkMemoryRateLimit(key, 3, 60, now);
      expect(r3.allowed).toBe(true);
      expect(r3.remaining).toBe(0);
      expect(r3.current).toBe(3);

      const r4 = checkMemoryRateLimit(key, 3, 60, now);
      expect(r4.allowed).toBe(false);
      expect(r4.remaining).toBe(0);
      expect(r4.current).toBe(4);
      expect(r4.retryAfterSeconds).toBe(60);
    });

    it("resets counter after window expires", () => {
      const start = new Date("2026-10-27T12:00:00Z");
      const key = "test:window:reset";

      // Exhaust limit
      checkMemoryRateLimit(key, 2, 60, start);
      const blocked = checkMemoryRateLimit(key, 2, 60, start);
      expect(blocked.allowed).toBe(true);
      expect(blocked.remaining).toBe(0);

      const over = checkMemoryRateLimit(key, 2, 60, start);
      expect(over.allowed).toBe(false);

      // Advance time past the 60 second window
      const afterWindow = new Date("2026-10-27T12:01:05Z");
      const fresh = checkMemoryRateLimit(key, 2, 60, afterWindow);
      expect(fresh.allowed).toBe(true);
      expect(fresh.current).toBe(1);
      expect(fresh.remaining).toBe(1);
    });
  });

  describe("Fail-safe behavior & Production Failure Policies", () => {
    it("safely falls back to memory limiter in test/dev mode when configured", async () => {
      const key = "fallback:test:key";
      // No db provided, no databaseUrl provided, explicit memory_fallback
      const res = await checkRateLimit({
        key,
        limit: 2,
        windowSeconds: 30,
        failurePolicy: "memory_fallback",
      });

      expect(res.source).toBe("memory_fallback");
      expect(res.allowed).toBe(true);
      expect(res.remaining).toBe(1);

      const res2 = await checkRateLimit({
        key,
        limit: 2,
        windowSeconds: 30,
        failurePolicy: "memory_fallback",
      });
      expect(res2.allowed).toBe(true);
      expect(res2.remaining).toBe(0);

      const res3 = await checkRateLimit({
        key,
        limit: 2,
        windowSeconds: 30,
        failurePolicy: "memory_fallback",
      });
      expect(res3.allowed).toBe(false);
      expect(res3.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("fails closed with database_error when failurePolicy is fail_closed_503 on database query failure", async () => {
      const mockFailingDb: any = {
        insert: () => {
          throw new Error("Neon compute connection timeout");
        },
      };

      const res = await checkRateLimit({
        key: "failing:db:key",
        limit: 5,
        windowSeconds: 60,
        db: mockFailingDb,
        failurePolicy: "fail_closed_503",
      });

      expect(res.allowed).toBe(false);
      expect(res.source).toBe("database_error");
      expect(res.remaining).toBe(0);
      expect(res.retryAfterSeconds).toBe(60);
    });

    it("returns limiter_unavailable in checkEndpointRateLimit when shared limiter fails", async () => {
      const mockFailingDb: any = {
        insert: () => {
          throw new Error("Connection reset by peer");
        },
      };

      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: { "cf-connecting-ip": "203.0.113.88" },
      });

      const result = await checkEndpointRateLimit(req, {
        endpoint: "customer_login",
        ipLimit: { limit: 10, windowSeconds: 60 },
        db: mockFailingDb,
        failurePolicy: "fail_closed_503",
      });

      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.reason).toBe("limiter_unavailable");
        expect(result.retryAfterSeconds).toBe(60);
      }
    });

    it("demonstrates why memory fallback is unsafe across distributed worker isolates", () => {
      // Simulate two separate worker isolates with independent memory spaces
      const isolate1Store = new Map<string, { count: number; resetAt: number }>();
      const isolate2Store = new Map<string, { count: number; resetAt: number }>();

      const key = "attacker_ip";
      const limit = 2;

      // Attacker sends 2 requests to isolate 1 (exhausts limit on isolate 1)
      isolate1Store.set(key, { count: 2, resetAt: Date.now() + 60000 });
      expect(isolate1Store.get(key)!.count >= limit).toBe(true);

      // But isolate 2 has empty memory, allowing the attacker to bypass the limit!
      expect(isolate2Store.has(key)).toBe(false);

      // This confirms why production must fail closed with 503 instead of falling back to isolate memory
    });
  });

  describe("Endpoint-level rate check", () => {
    it("enforces IP limit before identifier limit", async () => {
      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: { "cf-connecting-ip": "198.51.100.77" },
      });

      // Limit IP to 2 requests
      const r1 = await checkEndpointRateLimit(req, {
        endpoint: "test_ep",
        ipLimit: { limit: 2, windowSeconds: 60 },
        idLimit: { identifier: "target@test.com", limit: 5, windowSeconds: 60 },
      });
      expect(r1.allowed).toBe(true);

      const r2 = await checkEndpointRateLimit(req, {
        endpoint: "test_ep",
        ipLimit: { limit: 2, windowSeconds: 60 },
        idLimit: { identifier: "target@test.com", limit: 5, windowSeconds: 60 },
      });
      expect(r2.allowed).toBe(true);

      const r3 = await checkEndpointRateLimit(req, {
        endpoint: "test_ep",
        ipLimit: { limit: 2, windowSeconds: 60 },
        idLimit: { identifier: "target@test.com", limit: 5, windowSeconds: 60 },
      });
      expect(r3.allowed).toBe(false);
      if (!r3.allowed) {
        expect(r3.reason).toBe("ip_limit_exceeded");
        expect(r3.retryAfterSeconds).toBeGreaterThan(0);
      }
    });

    it("enforces account identifier limit when IP limit is still valid", async () => {
      // Simulate multiple requests for same email from different IPs (or high IP allowance)
      const req = new Request("https://spnhealthmix.in/api/auth/login", {
        headers: { "cf-connecting-ip": "198.51.100.88" },
      });

      const options = {
        endpoint: "test_acc",
        ipLimit: { limit: 100, windowSeconds: 60 },
        idLimit: { identifier: "victim@example.com", limit: 2, windowSeconds: 60 },
      };

      const r1 = await checkEndpointRateLimit(req, options);
      expect(r1.allowed).toBe(true);

      const r2 = await checkEndpointRateLimit(req, options);
      expect(r2.allowed).toBe(true);

      const r3 = await checkEndpointRateLimit(req, options);
      expect(r3.allowed).toBe(false);
      if (!r3.allowed) {
        expect(r3.reason).toBe("id_limit_exceeded");
      }
    });
  });
});

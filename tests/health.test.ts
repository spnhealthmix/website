import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as livenessGET, POST as livenessPOST } from "../src/app/api/health/route";
import { GET as readinessGET, POST as readinessPOST } from "../src/app/api/health/ready/route";
import { checkReadiness, getReadinessTimeoutMs } from "../src/lib/health";

describe("Health Check Endpoints (Phase 4)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Liveness Probe (GET /api/health)", () => {
    it("returns HTTP 200 with minimal status: ok payload", async () => {
      const req = new Request("https://spnhealthmix.com/api/health", { method: "GET" });
      const res = await livenessGET(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ status: "ok" });
    });

    it("does not query the database or require DATABASE_URL", async () => {
      const origUrl = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        const req = new Request("https://spnhealthmix.com/api/health", { method: "GET" });
        const res = await livenessGET(req);
        expect(res.status).toBe(200);
        const data = await res.json();
        expect(data).toEqual({ status: "ok" });
      } finally {
        if (origUrl) process.env.DATABASE_URL = origUrl;
      }
    });

    it("includes Cache-Control: no-store and x-request-id headers", async () => {
      const req = new Request("https://spnhealthmix.com/api/health", {
        method: "GET",
        headers: { "x-request-id": "req-live-12345" },
      });
      const res = await livenessGET(req);

      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("x-request-id")).toBe("req-live-12345");
    });

    it("rejects non-GET methods with HTTP 405 Method Not Allowed", async () => {
      const req = new Request("https://spnhealthmix.com/api/health", { method: "POST" });
      const res = await livenessPOST(req);

      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toContain("GET");
      const data = await res.json();
      expect(data).toEqual({ error: "Method Not Allowed" });
    });
  });

  describe("Readiness Probe Logic (checkReadiness)", () => {
    it("respects default timeout (3000ms) and configurable env var", () => {
      delete process.env.READINESS_DB_TIMEOUT_MS;
      expect(getReadinessTimeoutMs()).toBe(3000);

      process.env.READINESS_DB_TIMEOUT_MS = "1500";
      expect(getReadinessTimeoutMs()).toBe(1500);

      process.env.READINESS_DB_TIMEOUT_MS = "invalid";
      expect(getReadinessTimeoutMs()).toBe(3000);

      delete process.env.READINESS_DB_TIMEOUT_MS;
    });

    it("returns ready: true when database connectivity succeeds", async () => {
      const result = await checkReadiness({
        databaseUrl: "postgresql://user:pass@localhost:5432/db",
        customExecutor: async () => [{ 1: 1 }],
      });

      expect(result.ready).toBe(true);
      expect(result.checks.database).toBe("ok");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it("returns ready: false when database query throws an error", async () => {
      const result = await checkReadiness({
        databaseUrl: "postgresql://user:secretPassword@ep-failing.neon.tech/neondb",
        customExecutor: async () => {
          throw new Error("connection to server at ep-failing.neon.tech failed: FATAL: password authentication failed for user user");
        },
      });

      expect(result.ready).toBe(false);
      expect(result.checks.database).toBe("unavailable");
      // Result must NOT leak the password or connection details
      expect(JSON.stringify(result)).not.toContain("secretPassword");
      expect(JSON.stringify(result)).not.toContain("ep-failing.neon.tech");
    });

    it("returns ready: false when query times out and aborts fetch signal", async () => {
      let receivedSignal: AbortSignal | undefined;

      const result = await checkReadiness({
        timeoutMs: 50,
        databaseUrl: "postgresql://user:pass@localhost:5432/db",
        customExecutor: async (signal) => {
          receivedSignal = signal;
          return new Promise((resolve, reject) => {
            signal.addEventListener("abort", () => {
              reject(new Error("This operation was aborted"));
            });
            setTimeout(() => resolve([{ 1: 1 }]), 500);
          });
        },
      });

      expect(result.ready).toBe(false);
      expect(result.checks.database).toBe("unavailable");
      expect(receivedSignal?.aborted).toBe(true);
    });

    it("returns ready: false when DATABASE_URL is not set", async () => {
      const orig = process.env.DATABASE_URL;
      delete process.env.DATABASE_URL;

      try {
        const result = await checkReadiness({ databaseUrl: "" });
        expect(result.ready).toBe(false);
        expect(result.checks.database).toBe("unavailable");
      } finally {
        if (orig) process.env.DATABASE_URL = orig;
      }
    });
  });

  describe("Readiness Endpoint (GET /api/health/ready)", () => {
    it("returns HTTP 200 and ready payload when database is available", async () => {
      // Mock successful database check
      vi.spyOn(await import("../src/lib/health"), "checkReadiness").mockResolvedValue({
        ready: true,
        checks: { database: "ok" },
        durationMs: 12,
      });

      const req = new Request("https://spnhealthmix.com/api/health/ready", {
        method: "GET",
        headers: { "x-request-id": "req-ready-success-123" },
      });
      const res = await readinessGET(req);

      expect(res.status).toBe(200);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("x-request-id")).toBe("req-ready-success-123");

      const data = await res.json();
      expect(data).toEqual({
        status: "ready",
        checks: {
          database: "ok",
        },
      });
    });

    it("returns HTTP 503 and not_ready payload when database is unavailable", async () => {
      // Mock failed database check
      vi.spyOn(await import("../src/lib/health"), "checkReadiness").mockResolvedValue({
        ready: false,
        checks: { database: "unavailable" },
        durationMs: 3001,
      });

      const req = new Request("https://spnhealthmix.com/api/health/ready", {
        method: "GET",
        headers: { "x-request-id": "req-ready-fail-999" },
      });
      const res = await readinessGET(req);

      expect(res.status).toBe(503);
      expect(res.headers.get("Cache-Control")).toContain("no-store");
      expect(res.headers.get("x-request-id")).toBe("req-ready-fail-999");

      const data = await res.json();
      expect(data).toEqual({
        status: "not_ready",
        checks: {
          database: "unavailable",
        },
      });

      // Confirm no error string or internal stack trace is leaked in response
      const rawText = JSON.stringify(data);
      expect(rawText).not.toContain("error");
      expect(rawText).not.toContain("stack");
      expect(rawText).not.toContain("postgres");
    });

    it("rejects non-GET methods on /api/health/ready with HTTP 405", async () => {
      const req = new Request("https://spnhealthmix.com/api/health/ready", { method: "POST" });
      const res = await readinessPOST(req);

      expect(res.status).toBe(405);
      expect(res.headers.get("Allow")).toContain("GET");
      const data = await res.json();
      expect(data).toEqual({ error: "Method Not Allowed" });
    });
  });
});


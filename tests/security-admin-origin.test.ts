import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  normalizeAllowedOrigins,
  assertAdminOriginAllowed,
  assertCustomerOriginAllowed,
} from "../src/lib/security/origin";
import { secured, type ApiDeps } from "../src/lib/api/customer-api";
import { ApiError } from "../src/lib/api/http";

describe("SPN-SEC-005: Fail-Closed Administrative Origin Validation", () => {
  const originalAppOrigins = process.env.APP_ORIGINS;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    delete process.env.APP_ORIGINS;
    delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  afterEach(() => {
    if (originalAppOrigins !== undefined) process.env.APP_ORIGINS = originalAppOrigins;
    else delete process.env.APP_ORIGINS;
    if (originalSiteUrl !== undefined) process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
    else delete process.env.NEXT_PUBLIC_SITE_URL;
  });

  describe("Allowlist normalization and safety", () => {
    it("safely normalizes comma-separated string of origins", () => {
      const normalized = normalizeAllowedOrigins(
        " https://spnhealthmix.in , http://localhost:3000/path?query=1 , https://admin.spnhealthmix.in/ ",
      );
      expect(normalized).toEqual([
        "https://spnhealthmix.in",
        "http://localhost:3000",
        "https://admin.spnhealthmix.in",
      ]);
    });

    it("handles array of origins and deduplicates", () => {
      const normalized = normalizeAllowedOrigins([
        "https://spnhealthmix.in",
        "https://spnhealthmix.in/",
        "HTTPS://SPNHEALTHMIX.IN",
      ]);
      expect(normalized).toEqual(["https://spnhealthmix.in"]);
    });

    it("discards malformed strings and invalid non-http(s) protocols", () => {
      const normalized = normalizeAllowedOrigins(
        "javascript:alert(1), not-a-url, data:text/html, ftp://files.test, https://valid.com",
      );
      expect(normalized).toEqual(["https://valid.com"]);
    });

    it("returns empty array for empty, undefined, or whitespace-only configurations", () => {
      expect(normalizeAllowedOrigins(undefined)).toEqual([]);
      expect(normalizeAllowedOrigins("")).toEqual([]);
      expect(normalizeAllowedOrigins("   ,   , ")).toEqual([]);
    });
  });

  describe("Fail-closed behavior on missing or empty configuration", () => {
    it("fails closed with 500 ORIGIN_CONFIG_ERROR when allowlist is undefined", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "https://spnhealthmix.in" },
      });

      expect(() => assertAdminOriginAllowed(req, undefined)).toThrowError(
        expect.objectContaining({
          status: 500,
          code: "ORIGIN_CONFIG_ERROR",
        }),
      );
    });

    it("fails closed with 500 ORIGIN_CONFIG_ERROR when allowlist is empty", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "https://spnhealthmix.in" },
      });

      expect(() => assertAdminOriginAllowed(req, [])).toThrowError(
        expect.objectContaining({
          status: 500,
          code: "ORIGIN_CONFIG_ERROR",
        }),
      );
    });
  });

  describe("Origin header verification on administrative mutations", () => {
    const allowed = ["https://spnhealthmix.in", "https://admin.spnhealthmix.in"];

    it("allows valid requests matching the allowlist", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "https://spnhealthmix.in" },
      });

      expect(() => assertAdminOriginAllowed(req, allowed)).not.toThrow();
    });

    it("allows matching origins regardless of header casing", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "HTTPS://SPNHEALTHMIX.IN" },
      });

      expect(() => assertAdminOriginAllowed(req, allowed)).not.toThrow();
    });

    it("rejects unauthorized cross-origin requests with 403 FORBIDDEN_ORIGIN", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "https://evil-attacker.com" },
      });

      expect(() => assertAdminOriginAllowed(req, allowed)).toThrowError(
        expect.objectContaining({
          status: 403,
          code: "FORBIDDEN_ORIGIN",
        }),
      );
    });

    it("rejects missing Origin header with 403 FORBIDDEN_ORIGIN", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
      });

      expect(() => assertAdminOriginAllowed(req, allowed)).toThrowError(
        expect.objectContaining({
          status: 403,
          code: "FORBIDDEN_ORIGIN",
        }),
      );
    });

    it("rejects 'Origin: null' with 403 FORBIDDEN_ORIGIN", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "null" },
      });

      expect(() => assertAdminOriginAllowed(req, allowed)).toThrowError(
        expect.objectContaining({
          status: 403,
          code: "FORBIDDEN_ORIGIN",
        }),
      );
    });

    it("rejects malformed Origin header with 403 FORBIDDEN_ORIGIN", () => {
      const req = new Request("https://spnhealthmix.in/api/admin/orders/1/status", {
        method: "PATCH",
        headers: { origin: "malformed_not_a_valid_url" },
      });

      expect(() => assertAdminOriginAllowed(req, allowed)).toThrowError(
        expect.objectContaining({
          status: 403,
          code: "FORBIDDEN_ORIGIN",
        }),
      );
    });
  });

  describe("Integration with secured() pipeline", () => {
    const mockDeps: ApiDeps = {
      withDb: async (fn) => fn({} as any),
      authenticate: async () => ({ profileId: "admin_1", role: "admin" } as any),
      gateway: {} as any,
      razorpayKeyId: "key",
      razorpayKeySecret: "secret",
      allowedOrigins: ["https://spnhealthmix.in"],
    };

    it("permits administrative mutation when Origin is allowed", async () => {
      const req = new Request("https://spnhealthmix.in/api/admin/test", {
        method: "POST",
        headers: { origin: "https://spnhealthmix.in" },
      });

      const res = await secured(
        mockDeps,
        req,
        { mutating: true, requireOrigin: true },
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("fails closed with 500 when deps.allowedOrigins is missing on admin mutation", async () => {
      const req = new Request("https://spnhealthmix.in/api/admin/test", {
        method: "POST",
        headers: { origin: "https://spnhealthmix.in" },
      });

      const res = await secured(
        { ...mockDeps, allowedOrigins: undefined },
        req,
        { mutating: true, requireOrigin: true },
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      expect(res.status).toBe(500);
      const data = await res.json();
      expect(data.error.code).toBe("ORIGIN_CONFIG_ERROR");
    });

    it("rejects disallowed origin before reaching authentication or database layer", async () => {
      const authSpy = vi.fn();
      const testDeps: ApiDeps = {
        ...mockDeps,
        authenticate: authSpy,
      };

      const req = new Request("https://spnhealthmix.in/api/admin/test", {
        method: "POST",
        headers: { origin: "https://unauthorized-origin.com" },
      });

      const res = await secured(
        testDeps,
        req,
        { mutating: true, requireOrigin: true },
        async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );

      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error.code).toBe("FORBIDDEN_ORIGIN");
      expect(authSpy).not.toHaveBeenCalled();
    });
  });
});

import { describe, expect, it, afterEach, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { customerAuthenticate } from "../src/lib/customers/auth";
import { verifyAdminSession } from "../src/lib/admin/auth";
import * as sessionModule from "../src/lib/auth/session";

describe("SPN-SEC-001: Standalone payment flow decommissioning", () => {
  const root = path.resolve(__dirname, "..");

  it("confirms standalone order creation and verification routes are removed", () => {
    const forbiddenPaths = [
      path.join(root, "src/app/api/create-order/route.ts"),
      path.join(root, "src/app/api/create-order"),
      path.join(root, "src/app/api/verify-payment/route.ts"),
      path.join(root, "src/app/api/verify-payment"),
      path.join(root, "src/app/(storefront)/checkout/razorpay/page.tsx"),
      path.join(root, "src/app/(storefront)/checkout/razorpay"),
      path.join(root, "src/components/checkout/razorpay-checkout-button.tsx"),
    ];

    for (const p of forbiddenPaths) {
      expect(fs.existsSync(p), `File or directory must be deleted: ${p}`).toBe(false);
    }
  });

  it("verifies no remaining source files reference the decommissioned endpoints or component", () => {
    const srcDir = path.join(root, "src");
    const forbiddenTerms = [
      "/api/create-order",
      "/api/verify-payment",
      "RazorpayCheckoutButton",
      "/checkout/razorpay",
    ];

    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(fullPath);
        } else if (entry.isFile() && /\.(ts|tsx|js|jsx|mjs)$/.test(entry.name)) {
          const content = fs.readFileSync(fullPath, "utf-8");
          for (const term of forbiddenTerms) {
            expect(
              content.includes(term),
              `Found forbidden reference "${term}" in ${fullPath}`,
            ).toBe(false);
          }
        }
      }
    }

    checkDir(srcDir);
  });
});

describe("SPN-SEC-002: Test-header (x-test-user) authentication restrictions", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    (process.env as any).NODE_ENV = originalNodeEnv;
    vi.restoreAllMocks();
  });

  const dummyDb: any = {
    select: () => dummyDb,
    from: () => dummyDb,
    where: () => dummyDb,
    innerJoin: () => dummyDb,
    limit: () => [],
  };

  const nonTestEnvironments = [
    "production",
    "development",
    "staging",
    "preview",
    "",
    undefined,
    "test-pipeline",
    "uat",
  ];

  for (const envVal of nonTestEnvironments) {
    it(`rejects x-test-user in customerAuthenticate when NODE_ENV is ${envVal === undefined ? "undefined" : `'${envVal}'`}`, async () => {
      if (envVal === undefined) {
        delete (process.env as any).NODE_ENV;
      } else {
        (process.env as any).NODE_ENV = envVal;
      }

      const req = new Request("https://spnhealthmix.in/api/me", {
        headers: { "x-test-user": "malicious-actor" },
      });

      const user = await customerAuthenticate(req, dummyDb);
      expect(user).toBeNull();
    });

    it(`rejects x-test-user in verifyAdminSession when NODE_ENV is ${envVal === undefined ? "undefined" : `'${envVal}'`}`, async () => {
      if (envVal === undefined) {
        delete (process.env as any).NODE_ENV;
      } else {
        (process.env as any).NODE_ENV = envVal;
      }

      const req = new Request("https://spnhealthmix.in/api/admin/dashboard", {
        headers: { "x-test-user": "malicious-actor" },
      });

      const result = await verifyAdminSession(req);
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.reason).toBe("UNAUTHENTICATED");
      }
    });
  }

  it("allows test-header path ONLY when NODE_ENV === 'test'", async () => {
    (process.env as any).NODE_ENV = "test";

    const mockProfileModule = await import("../src/lib/customers/profile");
    const ensureProfileSpy = vi.spyOn(mockProfileModule, "ensureProfile").mockResolvedValueOnce({
      profileId: "test-user-id",
      role: "customer",
    });

    const req = new Request("https://spnhealthmix.in/api/me", {
      headers: { "x-test-user": "automated-test-runner" },
    });

    const user = await customerAuthenticate(req, dummyDb);
    expect(ensureProfileSpy).toHaveBeenCalledTimes(1);
    expect(user).toEqual({
      profileId: "test-user-id",
      role: "customer",
    });
  });

  it("verifies ordinary session-based customer authentication works when valid session cookie is provided", async () => {
    (process.env as any).NODE_ENV = "production";

    vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
      sessionId: "sess-123",
      profile: {
        id: "cust-456",
        email: "customer@example.com",
        name: "Test Customer",
        phone: "9876543210",
        role: "customer",
      },
    });

    const req = new Request("https://spnhealthmix.in/api/me", {
      headers: {
        Cookie: "spn_session=valid-customer-session-token",
      },
    });

    const user = await customerAuthenticate(req, dummyDb);
    expect(user).toEqual({
      profileId: "cust-456",
      role: "customer",
    });
  });

  it("verifies ordinary session-based admin authentication succeeds when valid admin cookie is provided", async () => {
    (process.env as any).NODE_ENV = "production";
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mockdb";

    try {
      vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
        sessionId: "admin-sess-789",
        profile: {
          id: "admin-123",
          email: "admin@spnfoods.com",
          name: "Store Admin",
          phone: "9876543210",
          role: "admin",
        },
      });

      const req = new Request("https://spnhealthmix.in/api/admin/dashboard", {
        headers: {
          Cookie: "spn_session=valid-admin-session-token",
        },
      });

      const result = await verifyAdminSession(req);
      expect(result.authorized).toBe(true);
      if (result.authorized) {
        expect(result.profile.role).toBe("admin");
        expect(result.profile.email).toBe("admin@spnfoods.com");
      }
    } finally {
      process.env.DATABASE_URL = originalDbUrl;
    }
  });

  it("verifies non-admin customer session is rejected with FORBIDDEN in admin authentication", async () => {
    (process.env as any).NODE_ENV = "production";
    const originalDbUrl = process.env.DATABASE_URL;
    process.env.DATABASE_URL = "postgresql://mock:mock@localhost:5432/mockdb";

    try {
      vi.spyOn(sessionModule, "validateSession").mockResolvedValueOnce({
        sessionId: "cust-sess-789",
        profile: {
          id: "cust-123",
          email: "customer@example.com",
          name: "Regular Customer",
          phone: "9876543210",
          role: "customer",
        },
      });

      const req = new Request("https://spnhealthmix.in/api/admin/dashboard", {
        headers: {
          Cookie: "spn_session=regular-customer-token",
        },
      });

      const result = await verifyAdminSession(req);
      expect(result.authorized).toBe(false);
      if (!result.authorized) {
        expect(result.reason).toBe("FORBIDDEN");
      }
    } finally {
      process.env.DATABASE_URL = originalDbUrl;
    }
  });
});

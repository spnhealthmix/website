import { dispatchAdminRequest } from "@/lib/api/admin-router";
import { json } from "@/lib/api/http";
import type { ApiDeps } from "@/lib/api/customer-api";
import { getTxDb } from "@/lib/db";
import { getStorage } from "@/lib/storage/storage";
import { extractSessionTokenFromRequest, validateSession } from "@/lib/auth/session";
import { revalidatePath } from "next/cache";
import { normalizeAllowedOrigins } from "@/lib/security/origin";
import { createRequestLogger, REQUEST_ID_HEADER, logError } from "@/lib/logger";
import { captureAppException } from "@/lib/sentry";

export const dynamic = "force-dynamic";

function getDeps(req: Request): ApiDeps {
  const databaseUrl = process.env.DATABASE_URL!;
  const allowedOrigins = normalizeAllowedOrigins(process.env.APP_ORIGINS);

  // Cloudflare R2 bucket binding or S3-compatible client
  const storage = getStorage();

  const pathname = new URL(req.url).pathname;
  const { logger, requestId } = createRequestLogger(req, pathname, { userRole: "admin" });

  return {
    withDb: async (fn) => {
      const { db, close } = getTxDb(databaseUrl);
      try {
        return await fn(db);
      } finally {
        await close();
      }
    },
    authenticate: async (_req, db) => {
      // Strictly allow x-test-user header ONLY in automated test execution (Vitest)
      const testUser = _req.headers.get("x-test-user");
      if (testUser && process.env.NODE_ENV === "test") {
        const { ensureProfile } = await import("@/lib/customers/profile");
        const p = await ensureProfile(db, testUser, async () => ({
          email: `${testUser}@example.com`,
          name: testUser,
        }));
        if (p) p.role = "admin";
        return p;
      }

      const token = extractSessionTokenFromRequest(_req);
      if (!token) return null;

      const validated = await validateSession(db, token);
      if (!validated || validated.profile.role !== "admin") {
        return null;
      }

      return {
        profileId: validated.profile.id,
        role: validated.profile.role,
      };
    },
    gateway: {
      createOrder: async () => {
        throw new Error("Razorpay not used in admin routes");
      },
    },
    razorpayKeyId: process.env.RAZORPAY_KEY_ID ?? "",
    razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET ?? "",
    allowedOrigins,
    storage,
    imageBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    logger,
    requestId,
    log: (msg, extra) => {
      if (extra instanceof Error) {
        logError(logger, extra, msg);
        captureAppException(extra, { requestId, route: pathname, userType: "admin" });
      } else {
        logger.error(extra ? (extra as any) : {}, msg);
      }
    },
  };
}

async function handle(req: Request) {
  const deps = getDeps(req);
  const res = await dispatchAdminRequest(req, deps);
  if (!res) {
    return json(404, { error: { code: "NOT_FOUND", message: "Admin endpoint not found." } }, undefined, deps.requestId);
  }

  if (deps.requestId && !res.headers.has(REQUEST_ID_HEADER)) {
    res.headers.set(REQUEST_ID_HEADER, deps.requestId);
  }

  // On successful database mutations (POST, PATCH, DELETE), invalidate the storefront cache
  // so updates to products, variants, categories, and settings propagate immediately to customers
  if (req.method !== "GET" && res.status >= 200 && res.status < 300) {
    try {
      revalidatePath("/", "layout");
      revalidatePath("/shop");
      revalidatePath("/combo-offers");
    } catch {
      // In standalone scripts or unit tests, safely continue
    }
  }

  return res;
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}

export async function PATCH(req: Request) {
  return handle(req);
}

export async function DELETE(req: Request) {
  return handle(req);
}

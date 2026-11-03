import { getDb, getTxDb } from "@/lib/db";
import { razorpayGateway } from "@/lib/payments/razorpay";
import type { PublicDeps } from "@/lib/api/public-api";
import type { ApiDeps } from "@/lib/api/customer-api";
import { customerAuthenticate } from "@/lib/customers/auth";
import { normalizeAllowedOrigins } from "@/lib/security/origin";
import { createRequestLogger, logError } from "@/lib/logger";
import { captureAppException } from "@/lib/sentry";

export function getPublicDeps(req?: Request): PublicDeps {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined.");
  }

  const pathname = req ? new URL(req.url).pathname : "/api/public";
  const { logger, requestId } = createRequestLogger(req, pathname);

  return {
    withDb: async (fn) => fn(getDb(databaseUrl)),
    imageBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    logger,
    requestId,
    log: (msg, extra) => {
      if (extra instanceof Error) {
        logError(logger, extra, msg);
        captureAppException(extra, { requestId, route: pathname });
      } else {
        logger.error(extra ? (extra as any) : {}, msg);
      }
    },
  };
}

export function getCustomerDeps(req: Request): ApiDeps {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined.");
  }

  const allowedOrigins = normalizeAllowedOrigins(process.env.APP_ORIGINS);
  const pathname = new URL(req.url).pathname;
  const { logger, requestId } = createRequestLogger(req, pathname);

  const razorpayKeyId = (
    process.env.RAZORPAY_KEY_ID ??
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ??
    ""
  ).trim();
  const razorpayKeySecret = (process.env.RAZORPAY_KEY_SECRET ?? "").trim();
  const gateway = razorpayGateway(razorpayKeyId, razorpayKeySecret);

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
      const user = await customerAuthenticate(_req, db);
      if (user) {
        logger.child({ userId: user.profileId, userRole: user.role });
      }
      return user;
    },
    gateway,
    razorpayKeyId,
    razorpayKeySecret,
    allowedOrigins,
    imageBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    logger,
    requestId,
    log: (msg, extra) => {
      if (extra instanceof Error) {
        logError(logger, extra, msg);
        captureAppException(extra, { requestId, route: pathname });
      } else {
        logger.error(extra ? (extra as any) : {}, msg);
      }
    },
  };
}

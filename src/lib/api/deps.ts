import { getDb, getTxDb } from "@/lib/db";
import { razorpayGateway } from "@/lib/payments/razorpay";
import type { PublicDeps } from "@/lib/api/public-api";
import type { ApiDeps } from "@/lib/api/customer-api";
import { customerAuthenticate } from "@/lib/customers/auth";

export function getPublicDeps(): PublicDeps {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined.");
  }
  return {
    withDb: async (fn) => fn(getDb(databaseUrl)),
    imageBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    log: (msg, extra) => console.error(msg, extra),
  };
}

export function getCustomerDeps(req: Request): ApiDeps {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL environment variable is not defined.");
  }

  const allowedOrigins = process.env.APP_ORIGINS
    ? process.env.APP_ORIGINS.split(",").map((s) => s.trim())
    : undefined;

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
      return customerAuthenticate(_req, db);
    },
    gateway,
    razorpayKeyId,
    razorpayKeySecret,
    allowedOrigins,
    imageBaseUrl: process.env.R2_PUBLIC_BASE_URL,
    log: (msg, extra) => console.error(msg, extra),
  };
}

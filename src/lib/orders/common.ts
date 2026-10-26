import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction, PgDatabase } from "drizzle-orm/pg-core";
import * as schema from "../db/schema";

export type AnyDb =
  | PgDatabase<any, typeof schema, any>
  | PgTransaction<any, typeof schema, ExtractTablesWithRelations<typeof schema>>;

export type OrderErrorCode =
  | "EMPTY_CART"
  | "INVALID_QUANTITY"
  | "VARIANT_UNAVAILABLE"
  | "INSUFFICIENT_STOCK"
  | "PRICE_CHANGED"
  | "PAYMENT_PROVIDER_ERROR";

export class OrderError extends Error {
  constructor(
    public readonly code: OrderErrorCode | string,
    message: string,
    public readonly variantId?: string,
    public readonly cause?: unknown,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

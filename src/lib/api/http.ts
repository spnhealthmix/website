import { z, ZodError, type ZodType } from "zod";
import { CartError } from "../cart/errors";
import { CustomerError } from "../customers/errors";
import { InvalidSignatureError } from "../customers/orders";
import { OrderError } from "../orders/common";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly extra: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function errorBody(code: string, message: string, extra?: Record<string, unknown>) {
  return {
    error: {
      code,
      message,
      ...(extra ?? {}),
    },
  };
}

export function json(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "private, no-store",
      ...(headers ?? {}),
    },
  });
}

export async function readJson(req: Request): Promise<unknown> {
  const contentType = req.headers.get("content-type");
  if (!contentType || !contentType.toLowerCase().includes("application/json")) {
    throw new ApiError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json.");
  }

  const raw = await req.text();
  try {
    return JSON.parse(raw);
  } catch {
    throw new ApiError(400, "BAD_JSON", "Malformed JSON body.");
  }
}

export function validate<T extends ZodType<any, any, any>>(schema: T, data: unknown): z.output<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const path = issue.path.join(".") || "_";
      if (!fields[path]) {
        fields[path] = issue.message;
      }
    }
    throw new ApiError(422, "VALIDATION_ERROR", "Validation failed.", { fields });
  }
  return result.data;
}

export function violatedConstraint(err: unknown): string | null {
  if (!err || typeof err !== "object") return null;
  const anyErr = err as Record<string, unknown>;
  const cause = (anyErr.cause as Record<string, unknown> | undefined) ?? anyErr;
  return typeof cause.constraint === "string" ? cause.constraint : null;
}

export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const anyErr = err as Record<string, unknown>;
  const cause = anyErr.cause as Record<string, unknown> | undefined;
  return anyErr.code === "23505" || cause?.code === "23505";
}

export function toResponse(
  err: unknown,
  log?: (msg: string, extra?: unknown) => void,
): Response {
  if (err instanceof ApiError) {
    return json(err.status, errorBody(err.code, err.message, err.extra));
  }

  if (err instanceof InvalidSignatureError) {
    return json(400, errorBody("INVALID_SIGNATURE", err.message || "Payment signature could not be verified."));
  }

  if (err instanceof CustomerError) {
    let status = 400;
    if (err.code === "ADDRESS_LIMIT_REACHED") status = 409;
    else if (
      err.code === "ADDRESS_NOT_FOUND" ||
      err.code === "ORDER_NOT_FOUND" ||
      err.code === "PROFILE_NOT_FOUND"
    ) {
      status = 404;
    }
    return json(status, errorBody(err.code, err.message, err.extra));
  }

  if (err instanceof OrderError) {
    let status = 400;
    if (err.code === "PAYMENT_PROVIDER_ERROR") status = 502;
    else if (err.code === "PRICE_CHANGED") status = 409;
    else if (err.code === "INSUFFICIENT_STOCK" || err.code === "VARIANT_UNAVAILABLE") status = 409;
    else if (err.code === "EMPTY_CART" || err.code === "INVALID_QUANTITY") status = 422;

    const extra: Record<string, unknown> = { ...(err.extra ?? {}) };
    if (err.variantId) extra.variantId = err.variantId;
    return json(status, errorBody(err.code, err.message, extra));
  }

  if (err instanceof CartError) {
    let status = 400;
    if (err.code === "QUANTITY_LIMIT" || err.code === "INVALID_QUANTITY") status = 422;
    else if (
      err.code === "INSUFFICIENT_STOCK" ||
      err.code === "CART_LINE_LIMIT" ||
      err.code === "VARIANT_UNAVAILABLE"
    ) {
      status = 409;
    }
    return json(status, errorBody(err.code, err.message, err.extra));
  }

  if (err instanceof ZodError) {
    const fields: Record<string, string> = {};
    for (const issue of err.issues) {
      const path = issue.path.join(".") || "_";
      if (!fields[path]) {
        fields[path] = issue.message;
      }
    }
    return json(422, errorBody("VALIDATION_ERROR", "Validation failed.", { fields }));
  }

  log?.("Unhandled error", err);
  return json(500, errorBody("INTERNAL_ERROR", "An unexpected error occurred."));
}

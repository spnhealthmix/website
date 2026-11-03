import pino from "pino";
import type { DestinationStream } from "pino";
import { redactSensitiveData, sanitizeString } from "./redact";
import { extractOrGenerateRequestId, REQUEST_ID_HEADER } from "./request-id";

export { extractOrGenerateRequestId, REQUEST_ID_HEADER, redactSensitiveData, sanitizeString };

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  userRole?: string;
  route?: string;
  method?: string;
  durationMs?: number;
  status?: number;
  errorName?: string;
  errorMessage?: string;
  stack?: string;
  [key: string]: unknown;
}

export interface StructuredLogger {
  debug(context: LogContext, message?: string): void;
  debug(message: string): void;
  info(context: LogContext, message?: string): void;
  info(message: string): void;
  warn(context: LogContext, message?: string): void;
  warn(message: string): void;
  error(context: LogContext, message?: string): void;
  error(message: string): void;
  child(bindings: LogContext): StructuredLogger;
}

export const REDACT_PATHS = [
  "password",
  "confirmPassword",
  "newPassword",
  "currentPassword",
  "token",
  "sessionToken",
  "refreshToken",
  "accessToken",
  "jwt",
  "secret",
  "webhookSecret",
  "keySecret",
  "razorpayKeySecret",
  "authorization",
  "cookie",
  "set-cookie",
  "databaseUrl",
  "email",
  "phone",
  "address",
  "shippingAddress",
  "*.password",
  "*.confirmPassword",
  "*.newPassword",
  "*.currentPassword",
  "*.token",
  "*.sessionToken",
  "*.refreshToken",
  "*.accessToken",
  "*.jwt",
  "*.secret",
  "*.webhookSecret",
  "*.keySecret",
  "*.razorpayKeySecret",
  "*.authorization",
  "*.cookie",
  "*.set-cookie",
  "*.databaseUrl",
  "*.email",
  "*.phone",
  "*.address",
  "*.shippingAddress",
];

const isProduction = process.env.NODE_ENV === "production";
const defaultLogLevel: LogLevel =
  (process.env.LOG_LEVEL as LogLevel) || (isProduction ? "info" : "debug");

/**
 * Creates a serverless-compatible Pino logger instance.
 * Writes directly to process.stdout or destination without worker threads to prevent execution freezes.
 */
export function createPinoInstance(destination?: DestinationStream): pino.Logger {
  return pino(
    {
      level: defaultLogLevel,
      timestamp: () => `,"time":"${new Date().toISOString()}"`,
      messageKey: "message",
      formatters: {
        level: (label) => ({ level: label }),
      },
      redact: {
        paths: REDACT_PATHS,
        censor: "[REDACTED]",
      },
    },
    destination ?? process.stdout,
  );
}

export class PinoStructuredLogger implements StructuredLogger {
  constructor(private readonly pinoInstance: pino.Logger) {}

  private prepare(contextOrMsg: LogContext | string, msg?: string): { ctx: LogContext; message: string } {
    if (typeof contextOrMsg === "string") {
      return { ctx: {}, message: contextOrMsg };
    }
    const cleanCtx = redactSensitiveData(contextOrMsg || {});
    return { ctx: cleanCtx, message: msg ?? "" };
  }

  debug(contextOrMsg: LogContext | string, message?: string): void {
    const { ctx, message: msg } = this.prepare(contextOrMsg, message);
    if (msg) this.pinoInstance.debug(ctx, msg);
    else this.pinoInstance.debug(ctx);
  }

  info(contextOrMsg: LogContext | string, message?: string): void {
    const { ctx, message: msg } = this.prepare(contextOrMsg, message);
    if (msg) this.pinoInstance.info(ctx, msg);
    else this.pinoInstance.info(ctx);
  }

  warn(contextOrMsg: LogContext | string, message?: string): void {
    const { ctx, message: msg } = this.prepare(contextOrMsg, message);
    if (msg) this.pinoInstance.warn(ctx, msg);
    else this.pinoInstance.warn(ctx);
  }

  error(contextOrMsg: LogContext | string, message?: string): void {
    const { ctx, message: msg } = this.prepare(contextOrMsg, message);
    if (msg) this.pinoInstance.error(ctx, msg);
    else this.pinoInstance.error(ctx);
  }

  child(bindings: LogContext): StructuredLogger {
    const cleanBindings = redactSensitiveData(bindings);
    return new PinoStructuredLogger(this.pinoInstance.child(cleanBindings));
  }
}

/** Root singleton logger */
export const rootLogger: StructuredLogger = new PinoStructuredLogger(createPinoInstance());

/**
 * Creates a scoped request logger with bound request ID, HTTP method, and route.
 */
export function createRequestLogger(
  req: Request | Headers | HeadersInit | null | undefined,
  route: string,
  extraContext?: { userId?: string; userRole?: string; [key: string]: unknown },
  customLogger?: StructuredLogger,
): { logger: StructuredLogger; requestId: string } {
  const requestId = extractOrGenerateRequestId(req as any);
  let method: string | undefined;

  if (req && typeof req === "object" && "method" in req && typeof req.method === "string") {
    method = req.method.toUpperCase();
  }

  const bindings: LogContext = {
    requestId,
    route,
    ...(method ? { method } : {}),
    ...(extraContext ?? {}),
  };

  const parentLogger = customLogger ?? rootLogger;
  const logger = parentLogger.child(bindings);
  return { logger, requestId };
}

/**
 * Safe error logger helper that formats errors without disclosing stack traces in customer responses.
 */
export function logError(
  logger: StructuredLogger,
  err: unknown,
  message: string,
  extra?: LogContext,
): void {
  const errorContext: LogContext = { ...(extra ?? {}) };

  if (err instanceof Error) {
    errorContext.errorName = err.name;
    errorContext.errorMessage = sanitizeString(err.message);
    if (err.stack) {
      errorContext.stack = sanitizeString(err.stack);
    }
  } else if (typeof err === "string") {
    errorContext.errorMessage = sanitizeString(err);
  } else if (err && typeof err === "object") {
    const sanitizedObj = redactSensitiveData(err as Record<string, unknown>);
    Object.assign(errorContext, sanitizedObj);
  }

  logger.error(errorContext, message);
}

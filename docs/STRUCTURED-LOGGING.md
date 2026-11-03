# SPN Health Mix – Structured Logging Architecture & Standards

## 1. Overview & Architecture

SPN Health Mix employs a high-performance, serverless-optimized structured JSON logging architecture built on [Pino](https://getpino.io/). 

The logger is specifically tailored for Next.js App Router and Vercel serverless deployments:
- **Zero-Worker Direct stdout Streaming:** Writes directly to `process.stdout` in-process, eliminating thread pooling and avoiding execution freezing in serverless lambda environments.
- **Isomorphic & Runtime-Safe:** Client bundles and Edge middleware do not import Node-only internals (`pino`, `stream`, `node:crypto`). Request correlation and headers remain universal across edge and node runtimes.
- **Deterministic Request Tracing:** Every HTTP request receives an `x-request-id` header (preserving valid incoming tracing headers or generating high-entropy UUIDs) that flows through dependency injection into API responses and error reports.
- **Fail-Safe Automatic Redaction:** Centralized PII, credential, cookie, and database URL redaction prevents sensitive data from leaking into logs.

---

## 2. Structured Log Format

Every production log is emitted as a single-line JSON object adhering to the following schema:

```json
{
  "level": "info",
  "time": "2026-11-03T00:15:30.123Z",
  "requestId": "req_8e9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c",
  "route": "/api/checkout",
  "method": "POST",
  "userId": "e4731f75-f34a-4a95-ba04-60b68fba52c9",
  "userRole": "customer",
  "durationMs": 142,
  "orderId": "182e16ae-77fd-400c-88bf-7dc3184b6389",
  "orderNumber": "SPN-261103-XYZ12",
  "message": "Checkout order created"
}
```

### Key Fields:

| Field | Type | Description |
|---|---|---|
| `level` | `string` | Log level: `debug`, `info`, `warn`, or `error`. Formatted as label (not numeric). |
| `time` | `string` | ISO 8601 UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`). |
| `requestId` | `string` | Correlation identifier for tracing the complete request lifecycle. |
| `route` | `string` | API path or internal operation name (e.g. `/api/auth/login`). |
| `method` | `string` | HTTP method (`GET`, `POST`, `PATCH`, `DELETE`). |
| `userId` | `string` | Internal profile ID when authenticated. |
| `userRole` | `string` | Role (`customer` or `admin`) when authenticated. |
| `durationMs` | `number` | Processing duration in milliseconds where measured. |
| `message` | `string` | Human-readable explanation of the event. |

For failures and exceptions (`level: "error"`):
```json
{
  "level": "error",
  "time": "2026-11-03T00:16:05.456Z",
  "requestId": "req_a1b2c3d4e5f60718293a4b5c6d7e8f90",
  "route": "/api/auth/login",
  "method": "POST",
  "errorName": "DatabaseError",
  "errorMessage": "connection timeout while querying postgresql://user:[REDACTED]@ep-neon.tech/neondb",
  "stack": "Error: connection timeout...\n    at ...",
  "message": "Login request failed"
}
```

---

## 3. Log Levels

| Level | Purpose | When to Use | Default Environment |
|---|---|---|---|
| `debug` | Detailed operational diagnostics | Request payloads, internal cache lookups, query timing | Development, Test, or `LOG_LEVEL=debug` |
| `info` | Key business milestones | Logins, registrations, checkout creations, payment verifications | Production, Development |
| `warn` | Recoverable or edge-case anomalies | Expired idempotency replay, rate-limit warnings, transient retry attempts | Production, Development |
| `error` | Unexpected exceptions & failures | Unhandled 500s, database connection drops, gateway downtime | Production, Development |

Set the log level via the environment variable:
```bash
LOG_LEVEL=info # or debug, warn, error
```

---

## 4. Request ID Lifecycle

1. **Extraction / Generation:**
   - Incoming requests are inspected for `x-request-id`.
   - The value is validated against `/^[a-zA-Z0-9_-]{8,64}$/` to prevent HTTP header injection or buffer abuse.
   - If missing or invalid, a secure unique ID (`req_<uuid>`) is generated using the web standard `crypto.randomUUID()`.
2. **Context Binding:**
   - `createRequestLogger(req, route, context)` binds `requestId`, `route`, and `method` into a child logger.
3. **Response Header Propagation:**
   - Every API response returned to the client includes the response header:
     ```http
     x-request-id: req_8e9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c
     ```
   - Customers encountering errors can provide their `x-request-id` to support to immediately locate the corresponding server-side error log without exposing stack traces.

---

## 5. User Context Propagation

When an authenticated session is resolved via `deps.authenticate(req, db)`:
- The user's internal ID (`profileId`) and `userRole` (`customer` or `admin`) are attached to child log contexts.
- **Privacy Guarantee:** Personal identification details such as plaintext email addresses, customer names, phone numbers, and physical addresses are excluded from user context objects.

---

## 6. Security and Redaction Policy

To prevent secret leakage and comply with privacy standards, a dual-layer redaction system is enforced:

### Layer 1: Pino Native Wildcard Redaction
The root logger redacts any field matching:
- `password`, `confirmPassword`, `newPassword`, `currentPassword`, `*.password`, etc.
- `token`, `sessionToken`, `refreshToken`, `accessToken`, `jwt`, `*.token`, etc.
- `secret`, `webhookSecret`, `keySecret`, `razorpayKeySecret`, `*.secret`, etc.
- `authorization`, `cookie`, `set-cookie`, `*.authorization`, `*.cookie`, etc.
- `databaseUrl`, `*.databaseUrl`, `connectionString`
- `email`, `phone`, `address`, `shippingAddress`, `*.email`, `*.phone`

Censored with string: `[REDACTED]`.

### Layer 2: Deep Recursive & String Regex Sanitization (`src/lib/logger/redact.ts`)
- **Database URLs:** Sanitizes `postgres(ql)://user:password@host` to `postgresql://user:[REDACTED]@host` in raw error messages and stacks.
- **Bearer Tokens:** Sanitizes `Bearer <token>` to `Bearer [REDACTED]`.
- **Card Numbers:** Masks 13–19 digit numeric sequences to `[REDACTED_CARD]`.
- **Circular Safety:** Uses a `WeakSet` and depth limit (max 6) to prevent recursion crashes on cyclic structures.

---

## 7. How to Use in Application Code

### In API Routes (`src/app/api/.../route.ts`):
```ts
import { createRequestLogger, logError, REQUEST_ID_HEADER } from "@/lib/logger";

export async function POST(req: Request) {
  const { logger, requestId } = createRequestLogger(req, "/api/my-endpoint");
  
  try {
    logger.info("Operation started");
    // ...
    logger.info({ recordId: "123" }, "Operation completed");
    
    return Response.json({ success: true }, {
      headers: { [REQUEST_ID_HEADER]: requestId }
    });
  } catch (err) {
    logError(logger, err, "Operation failed");
    return Response.json({ error: "Internal Error" }, {
      status: 500,
      headers: { [REQUEST_ID_HEADER]: requestId }
    });
  }
}
```

### In Dependency-Injected Handlers (`src/lib/api/...`):
```ts
export const myHandler = (req: Request, deps: ApiDeps) => {
  deps.logger?.info({ action: "audit" }, "Business milestone");
};
```

---

## 8. Vercel Production Log Access

In Vercel:
1. Navigate to your project dashboard: `https://vercel.com/<team>/spn-health-mix`.
2. Go to **Logs** tab.
3. Filter by JSON fields:
   - To find an exact request: `requestId:"req_8e9a2b3c4d5e6f7a8b9c0d1e2f3a4b5c"`
   - To find errors on a route: `level:"error" route:"/api/checkout"`
   - To find activity by user ID: `userId:"e4731f75-f34a-4a95-ba04-60b68fba52c9"`


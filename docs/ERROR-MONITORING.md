# SPN Health Mix – Production Error Monitoring Architecture (Sentry)

This document describes the design, configuration, operational workflows, and security policies governing application error monitoring in the SPN Health Mix production application.

---

## 1. Sentry Architecture Overview

The error monitoring system utilizes the official `@sentry/nextjs` (v11) SDK integrated with Next.js 15 App Router and React 19 across all three operational runtimes:

```
                                  +---------------------------------------+
                                  |         Next.js Application           |
                                  +---------------------------------------+
                                                      |
                   +----------------------------------+----------------------------------+
                   |                                  |                                  |
                   v                                  v                                  v
       [Client / Browser Bundle]             [Serverless Node.js]               [Edge Runtime Routes]
       - sentry.client.config.ts             - sentry.server.config.ts          - sentry.edge.config.ts
       - src/app/global-error.tsx            - src/instrumentation.ts           - src/instrumentation.ts
       - Non-blocking telemetry              - Next 15 onRequestError           - Low-latency edge spans
                   |                                  |                                  |
                   +----------------------------------+----------------------------------+
                                                      |
                                                      v
                                        +----------------------------+
                                        |  scrubSentryEvent /        |
                                        |  scrubSentryBreadcrumb     |  (Strict Data Redaction Engine)
                                        +----------------------------+
                                                      |
                                                      v
                                        +----------------------------+
                                        |   Sentry Ingestion API     |
                                        | (Correlated via Request ID)|
                                        +----------------------------+
```

### Core Components
1. **`sentry.client.config.ts`**: Client-side initialization for browser environments.
2. **`sentry.server.config.ts`**: Node.js serverless function error monitoring and distributed tracing.
3. **`sentry.edge.config.ts`**: Edge runtime error monitoring.
4. **`src/instrumentation.ts`**: Next.js 15 App Router standard hook with `register()` and `onRequestError = Sentry.captureRequestError` for capturing unhandled Server Component and Route Handler errors.
5. **`src/app/global-error.tsx`**: Root React Error Boundary capturing unhandled client-side render exceptions and presenting a resilient fallback UI.
6. **`next.config.ts`**: Wrapped via `withSentryConfig` to enable release tracking, component annotation, and source map processing.
7. **`src/lib/sentry/index.ts`**: Centralized operational error capture wrapper (`captureAppException`), expected error filtering, and structured logging correlation.
8. **`src/lib/sentry/scrub.ts`**: Deep sanitization engine stripping all secrets, credentials, tokens, cookies, raw bodies, and customer PII before events leave the runtime boundary.

---

## 2. Configuration Steps

### Step 1: Install `@sentry/nextjs`
Ensure `@sentry/nextjs` (v11.x) is listed in `package.json`:
```bash
npm install @sentry/nextjs
```

### Step 2: Configure Environment Variables
Set the required environment variables in your deployment environments (see Section 3).

### Step 3: Verify Initialization
When the application starts, Sentry initializes if `SENTRY_DSN` (server) or `NEXT_PUBLIC_SENTRY_DSN` (client) is present. If neither variable is defined, Sentry remains disabled without throwing errors or impacting application performance.

---

## 3. Required Environment Variables & Vercel Setup

The application strictly avoids inventing credentials or baking secret values into code. Configure the following variables in the **Vercel Project Settings $\to$ Environment Variables**:

| Variable Name | Environments | Scope | Purpose |
|---|---|---|---|
| `SENTRY_DSN` | Production, Preview | Server / Edge | Ingestion endpoint for serverless and Edge runtime exception reports. |
| `NEXT_PUBLIC_SENTRY_DSN` | Production, Preview | Client / Browser | Ingestion endpoint for client-side browser exception reports. |
| `SENTRY_AUTH_TOKEN` | Production, Preview | Build Time Only | Required by `@sentry/nextjs` build plugin for source map upload during deployment. |
| `SENTRY_ORG` | Production, Preview | Build Time Only | Sentry organization slug (e.g. `spn-health-mix`). |
| `SENTRY_PROJECT` | Production, Preview | Build Time Only | Sentry project identifier (e.g. `spn-health-mix-backend`). |
| `VERCEL_ENV` | Provided by Vercel | Runtime | Environment tagging (`production`, `preview`, `development`). |
| `VERCEL_GIT_COMMIT_SHA` | Provided by Vercel | Runtime | Automatic release tracking and commit correlation. |

> [!NOTE]
> When `SENTRY_AUTH_TOKEN` is not configured (e.g. in local development or sandboxed builds), `next.config.ts` runs with `silent: !process.env.CI`, preventing build failures.

---

## 4. Error Filtering Policy (Noise Elimination)

To prevent alert fatigue and preserve ingestion quotas, Sentry **only records genuine operational failures and unhandled exceptions**.

### Filtering Rules (`shouldCaptureError`)

| Error Classification | HTTP Status | Reported to Sentry? | Reason |
|---|---|---|---|
| Validation Errors (`ZodError`, 422) | 422 / 400 | **NO** | Normal user input validation failure. |
| Authentication Failures (Invalid Password / Expired) | 401 | **NO** | Normal credential rejection. |
| Authorization Rejections (Forbidden) | 403 | **NO** | Normal permission refusal. |
| Not Found Responses (`ApiError` 404, `CustomerError` 404) | 404 | **NO** | Non-existent slug, product, address, or order. |
| Business Conflicts (`CartError` quantity/stock limits) | 409 | **NO** | Expected business logic constraint. |
| Rate Limit Rejections (`checkEndpointRateLimit`) | 429 / 503 | **NO** | Normal abuse mitigation control. |
| Invalid Payment Signatures (`InvalidSignatureError`) | 400 | **NO** | Fraud prevention / tampering rejection. |
| **Payment Gateway Outage (`PAYMENT_PROVIDER_ERROR`)** | 502 | **YES** | Critical 3rd-party dependency disruption. |
| **Unhandled Database Disconnections / Query Panics** | 500 | **YES** | Critical infrastructure failure. |
| **Unexpected Webhook Processing Failures** | 500 | **YES** | Payment or delivery event loss risk. |
| **Unhandled Runtime Exceptions (`TypeError`, etc.)** | 500 | **YES** | Application defect. |

---

## 5. Privacy, Redaction & Security Policy

In accordance with strict operational security boundaries, all telemetry is sanitized prior to dispatch.

### Centralized Scrubbing Rules (`scrubSentryEvent`, `scrubSentryBreadcrumb`)
1. **Raw Request Bodies:** `event.request.data` is **unconditionally deleted**. No request body payloads are sent to Sentry.
2. **Cookies:** `event.request.cookies` is replaced with `"[REDACTED]"`.
3. **HTTP Headers:** `authorization`, `cookie`, `set-cookie`, `x-api-key`, and `x-razorpay-signature` are scrubbed to `"[REDACTED]"`.
4. **Customer PII:**
   - `event.user.email` is **deleted**.
   - `event.user.phone` is **deleted**.
   - `event.user.ip_address` is **deleted**.
   - `event.user.username` is **deleted**.
   - `event.user.id` is retained **only** as the internal database UUID (e.g. `e4731f75-...`).
5. **Pattern Redactions:** Error messages, stack trace frame variables, and breadcrumb strings are sanitized through regex patterns:
   - Database connection strings (`postgresql://user:pass@host/db`) $\to$ `postgresql://user:[REDACTED]@host/db`.
   - Bearer tokens (`Bearer <jwt>`) $\to$ `Bearer [REDACTED]`.
   - Payment Card numbers (13-19 digits) $\to$ `"[REDACTED_CARD]"`.
   - Email addresses $\to$ `"[REDACTED_EMAIL]"`.
   - Phone numbers $\to$ `"[REDACTED_PHONE]"`.
   - Razorpay Keys / Secrets (`rzp_live_...`, `rzp_test_...`) $\to$ `"[REDACTED_KEY]"`.

---

## 6. Correlation with Structured Logging (Pino)

Every Sentry event captured in an API request is tagged with the unique request correlation ID from Phase 2:

- **Tag:** `request_id: <uuid>`
- **Tag:** `route: <path>` (e.g. `/api/webhooks/razorpay`)
- **Tag:** `method: <HTTP method>` (e.g. `POST`)

### Troubleshooting Correlation Workflow
When an alert fires in Sentry:
1. Copy the `request_id` tag from the Sentry issue page.
2. Open your centralized log aggregator (Vercel Log Drain, Datadog, Axiom).
3. Search `req.id == "<request_id>"`.
4. Inspect the exact sequence of JSON log entries leading up to the failure.

---

## 7. Performance & Sampling Guidelines

To ensure zero latency impact on customer checkout and payment processing:
- **Error Sampling Rate:** `1.0` (100% of genuine unexpected exceptions are reported).
- **Performance Traces Sample Rate:**
  - Production: `0.1` (10% sampling to minimize serverless overhead and avoid quota exhaustion).
  - Development / Staging: `1.0` (100% for testing).
- **Non-blocking Dispatch:** Sentry SDK uses background asynchronous transport (`fetch`) that does not block HTTP response completion.
- **Tunneling:** Enabled via `/monitoring` rewrite in `next.config.ts` to prevent browser ad-blockers from silently dropping client-side exception telemetry.

---

## 8. Alert Configuration Recommendations

Configure the following alert rules in the **Sentry Dashboard $\to$ Alerts**:

1. **High Priority – Payment Gateway Failures:**
   - Condition: `tag[feature] == "checkout"` OR `error.type == "OrderError"`
   - Threshold: $> 3$ events in 5 minutes
   - Action: PagerDuty / Telegram / Slack alert to on-call engineer.
2. **High Priority – Razorpay Webhook Failures:**
   - Condition: `tag[route] == "/api/webhooks/razorpay"`
   - Threshold: $> 2$ events in 10 minutes
   - Action: Slack `#ops-payments` channel alert.
3. **Medium Priority – Database Connectivity:**
   - Condition: `message matches "*connection*" OR *database*`
   - Threshold: $> 5$ events in 5 minutes
   - Action: Slack `#ops-database` channel alert.

---

## 9. Troubleshooting & FAQ

### Q: Why do I see "Failed to fetch Archivo from Google Fonts" during local builds?
This is a pre-existing Next.js font loader behavior when building inside a network-isolated sandbox. It has no relation to Sentry and resolves automatically in live deployment environments where internet access to `fonts.googleapis.com` is available.

### Q: Does Sentry report failed login attempts?
No. Incorrect password entries, non-existent customer emails, and rate limit responses (401/429) are expected business rejections and are filtered out by `shouldCaptureError`. Only unexpected crashes (e.g. database down, hashing library failure) are reported.

### Q: Can customer payment card numbers leak to Sentry?
No. Card data is handled client-side by Razorpay Checkout modal and never reaches the backend application. Furthermore, `scrubSentryEvent` deletes raw request bodies unconditionally and scans all strings with credit card regex patterns.


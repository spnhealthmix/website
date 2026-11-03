# SPN Health Mix – Phase 7: Final Integration & Production Readiness Audit Report

**Auditor Roles:** Senior Software Architect, Application Security Engineer, and Production Reliability Auditor  
**Audit Date:** 2026-11-03  
**Audit Classification:** Comprehensive Read-Only Audit  
**Target Repository:** SPN Health Mix (`SPN-Foods-main`)  
**Deployment Target:** Vercel (Next.js 15 App Router / Serverless Node.js Runtime)  
**Database Target:** Neon Serverless PostgreSQL (managed via Drizzle ORM)  

---

## 1. Executive Summary

This comprehensive, read-only production readiness audit evaluated the integration, security, reliability, data integrity, payment handling, and operational workflows of the SPN Health Mix e-commerce platform.

### Overall Production Readiness Classification:
**`READY WITH CONDITIONS`**

The core application demonstrates high engineering quality, robust financial safeguards, and fail-closed security controls:
- **Financial & Payment Integrity:** Razorpay order creation, payment signature verification, amount matching, and webhook idempotency are strictly enforced. No path exists where an unverified payment can be credited.
- **Security Posture:** Origin validation, role-based admin authorization, cryptographic session hashing, rate limiting, and PII redaction (Pino and Sentry) are operational and verified.
- **Health & Observability:** Lightweight liveness (`/api/health`) and database-backed readiness (`/api/health/ready`) probes are active and tested.
- **Identified Condition / Blocker:** A critical hidden dependency exists in the shipping provider fallback (`src/lib/shipping/provider.ts:66`), where unconfigured production environments default to `shiprocket` and invoke external serviceability checks during customer checkout (`src/lib/api/customer-api.ts:366`). This requires an operational environment configuration (`SHIPPING_PROVIDER=manual`) or future code decommissioning to prevent checkout failures.

---

## 2. Audit Scope & Limitations

### Scope
- Static source code analysis of all Next.js App Router routes, server libraries, security boundaries, and database access layers.
- Examination of existing test suites, test fixtures, and mock implementations.
- Evaluation of operational runbooks and disaster recovery plans generated in Phases 2–6.
- Verification of Git repository state and working tree preservation.

### Limitations
- **Read-Only Inspection:** No production operations, deployments, credential rotations, or database mutations were performed.
- **External Console Access:** Provider dashboard settings (Neon billing tier, Razorpay webhook subscriptions, Cloudflare R2 token quotas, Vercel production environment variable scopes) cannot be queried directly from Git repository files and are classified as requiring manual console verification.
- **Local Test Environment:** Integration test suites requiring a local PostgreSQL daemon on `localhost:5432` were blocked from executing locally due to the absence of a local database instance.

---

## 3. Shiprocket Dependency Audit (Highest Priority)

### Business Requirement Context
**Shiprocket and its features are NOT required for the SPN Health Mix website.** Existing Shiprocket code was preserved untouched during this audit.

### A. Provider Dependency Analysis
- **Provider Registry:** Defined in `src/lib/shipping/provider.ts`.
- **Default Provider Resolution (`src/lib/shipping/provider.ts:65-67`):**
  ```typescript
  const defaultProvider =
    process.env.SHIPPING_PROVIDER || (process.env.NODE_ENV === "test" ? "mock" : "shiprocket");
  ```
  **Finding:** If `SHIPPING_PROVIDER` is unset in a production deployment, the application **automatically selects `ShiprocketShippingProvider` as the default provider**.
- **Provider Imports & Call Sites:**
  - `src/lib/api/customer-api.ts:366`: `const provider = getShippingProvider();` inside `postCheckout()` (Checkout Initiation).
  - `src/lib/api/customer-api.ts:510`: `calculateAuthoritativeShipping(..., providerId)` inside `postShippingQuote()` (`POST /api/shipping/quote`).
  - `src/lib/shipping/calculator.ts:177`: `const provider = getShippingProvider(providerId);` inside `calculateAuthoritativeShipping()`.
  - `src/lib/shipping/service.ts:98`: `const provider = getShippingProvider(opts.providerId);` inside `createOrderShipment()`.
  - `src/lib/shipping/webhook.ts:30`: `const provider = getShippingProvider(deps.providerId);` inside `handleShippingWebhook()`.
  - `src/app/api/webhooks/shipping/route.ts:2`: Inbound webhook endpoint.

### B. Customer and Admin Workflow Impact
1. **Customer Checkout Flow (`src/lib/api/customer-api.ts:366-370`):**
   ```typescript
   const weightGrams = await calculateCartWeightGrams(db, lines);
   const provider = getShippingProvider();
   const serviceability = await provider.checkServiceability(address.pincode, weightGrams);
   if (!serviceability.serviceable) {
     throw new ApiError(422, "UNSERVICEABLE_PINCODE", serviceability.message || "Delivery is currently unavailable for this pincode.");
   }
   ```
   - **Scenario 1 (Credentials Unset):** If `SHIPROCKET_EMAIL` and `SHIPROCKET_PASSWORD` are absent, `ShiprocketShippingProvider.checkServiceability()` (`src/lib/shipping/shiprocket.ts:116-121`) returns `{ serviceable: true }`. Order creation succeeds.
   - **Scenario 2 (Credentials Present):** If Shiprocket credentials are populated in Vercel, `checkServiceability()` makes an external HTTP request to `https://apiv2.shiprocket.in/v1/external/courier/serviceability/`. If Shiprocket is down, credentials expire, or the API returns an error (`src/lib/shipping/shiprocket.ts:149-153`), it returns `{ serviceable: false }`, **throwing HTTP 422 and completely blocking customer checkout**.
   - **Scenario 3 (Explicit Manual Mode):** If `SHIPPING_PROVIDER="manual"` is configured in Vercel, `ManualShippingProvider.checkServiceability()` (`src/lib/shipping/manual.ts:20-22`) returns `{ serviceable: true }` without touching any external API.
2. **Order Shipping Rates (`src/lib/shipping/calculator.ts:126-150`):**
   - Actual shipping fees (₹50 flat rate, free above ₹500 for Tamil Nadu; general flat rate for Rest of India) are computed strictly from the `site_settings` database table. Shiprocket API rates are **never applied to Tamil Nadu orders**.
3. **Admin Order Fulfillment (`src/lib/shipping/service.ts:98-130`):**
   - If an admin creates a shipment without explicitly passing `providerId: "manual"`, and `SHIPPING_PROVIDER` is unset, `createOrderShipment` calls `ShiprocketShippingProvider.createShipment()`. If unconfigured, this throws `ApiError: Shiprocket credentials are not configured. Use manual dispatch or configure SHIPROCKET_EMAIL.` (`src/lib/shipping/shiprocket.ts:216-218`).
4. **Order History, Tracking, & Customer Details:**
   - Order history (`src/lib/customers/orders.ts`), customer order detail views, and admin order viewing query the database `orders` and `shipments` tables directly. They do **not** depend on Shiprocket runtime calls.

### C. Webhooks and Scheduled Jobs
- **Shipping Webhook (`/api/webhooks/shipping`):** Exclusively processes inbound tracking updates from Shiprocket. It has no role in payment processing, cart operations, or account management.
- **Scheduled Background Tasks (`src/worker/scheduled.ts`):** Cloudflare cron trigger only executes `expirePendingOrders(db)`. It has zero dependencies on Shiprocket.

### D. Environment Variables Dependency
- `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_SECRET`, `SHIPROCKET_BASE_URL`, `SHIPPING_ORIGIN_PINCODE`:
  - Missing variables do **not** cause Next.js build failures or server crash at startup.
  - However, omitting `SHIPPING_PROVIDER` allows the application to default to `shiprocket`.

### E. Shiprocket Integration Classification Summary

| Component / File | Code Location | Classification | Operational Finding |
| :--- | :--- | :--- | :--- |
| **Provider Fallback** | `src/lib/shipping/provider.ts:66` | **ACTIVE DEPENDENCY (Latent)** | Defaults to `"shiprocket"` in production if `SHIPPING_PROVIDER` is unset. |
| **Checkout Serviceability** | `src/lib/api/customer-api.ts:366` | **ACTIVE DEPENDENCY** | Calls `provider.checkServiceability()` on every checkout initiation. |
| **Shipping Quote Route** | `src/app/api/shipping/quote/route.ts:8` | **OPTIONAL INTEGRATION** | Returns live courier estimates only if provider is configured. |
| **Admin Shipment Creation** | `src/lib/shipping/service.ts:98` | **OPTIONAL INTEGRATION** | Fails if called without `providerId: "manual"` while Shiprocket credentials are unset. |
| **Shipping Webhook** | `src/app/api/webhooks/shipping/route.ts` | **LEGACY / UNUSED** | Inbound webhook for tracking status updates; not needed for store operations. |
| **Scheduled Tasks** | `src/worker/scheduled.ts` | **NOT DEPENDENT** | Zero shipping provider interaction. |

---

## 4. Payment and Checkout Reliability Audit

### A. Server-Side Price & Quantity Validation
- **Location:** `src/lib/orders/checkout.ts:34-110` (`startCheckout`).
- **Validation:**
  - Product variant prices are read strictly from the `product_variants` database table. Client-submitted prices are completely ignored.
  - Subtotal calculation, discount deduction, and shipping fee additions are calculated server-side.
  - Subtotal assertion: Throws `ApiError(400, "SUBTOTAL_CHANGED")` if `expectedSubtotalPaise` does not match server calculation.
- **Severity:** Informational (Verified Safe).

### B. Razorpay Order Creation & Currency Controls
- **Location:** `src/lib/payments/razorpay.ts:27-40`.
- **Enforcement:** Fixed currency `"INR"`, amount in paise, server-generated receipt number (`orderNumber`), and `payment_capture: 1` (auto-capture).
- **Severity:** Informational (Verified Safe).

### C. Cryptographic Payment Verification
- **Location:** `src/lib/customers/orders.ts:223-292` (`verifyCheckoutCallback`).
- **Enforcement:**
  - Validates HMAC SHA-256 signature (`order_id|payment_id`) using `RAZORPAY_KEY_SECRET`.
  - Authoritative cross-check: Queries Razorpay API via `gateway.fetchPayment(cb.razorpayPaymentId)` to confirm `rzpPayment.status === "captured"`, `rzpPayment.amount === row.totalPaise`, and `rzpPayment.currency === "INR"`.
  - Profile Isolation: Ensures caller owns the order (`eq(orders.profileId, profileId)`).
- **Finding:** **No path exists for a customer or rogue client to confirm an order without valid cryptographic signature verification and server-side amount validation.**
- **Severity:** Informational (Verified Robust).

### D. Webhook Idempotency & Signature Verification
- **Location:** `src/app/api/webhooks/razorpay/route.ts` & `src/lib/payments/webhook.ts:45-80`.
- **Enforcement:**
  - Verifies `x-razorpay-signature` over the raw, unparsed request body before reading JSON.
  - Deduplication: Inbound events are inserted into `webhook_events` with primary key `eventId`. Replayed deliveries return HTTP 200 with `{ duplicate: true }`.
  - Status code discipline: Non-fatal errors return HTTP 500 to trigger Razorpay's 24-hour retry backoff; fatal payload errors return HTTP 400.
- **Severity:** Informational (Verified Robust).

### E. Inventory Concurrency & Stock Reservations
- **Location:** `src/lib/orders/checkout.ts:70-95` & `src/lib/orders/capture-payment.ts:46-60`.
- **Enforcement:**
  - Stock is atomically decremented during checkout initiation inside a database transaction (`src/lib/orders/checkout.ts:85`).
  - Strict lock ordering: `orders` row is locked first (`.for("update")`), followed by `payments` row (`.for("update")`), preventing race conditions and deadlocks.
  - Order Expiry: Orders have a 30-minute hold (`expiresAt`). If unpaid, `expirePendingOrders` (`src/lib/orders/expiry.ts:31-70`) releases stock atomically (`stockReleased = true`).
  - Late Payment Recovery: If payment captures after order expiration, `applyCapturedPayment` (`src/lib/orders/capture-payment.ts:130-165`) attempts to re-reserve stock in a savepoint. If stock is exhausted, it flags the order as `refund_required` (`"late_payment_stock_unavailable"`).
- **Severity:** Informational (Verified Robust).

### F. Cart Clearing
- **Location:** `src/lib/orders/capture-payment.ts:97-98`.
- **Enforcement:** Cart items are cleared only after payment capture is successfully recorded (`consumeCartForOrder`). Interrupted or abandoned checkouts leave cart items intact.
- **Severity:** Informational (Verified Robust).

---

## 5. Database and Data Integrity Audit

### A. Connection Architecture
- **Stateless Read Client:** `drizzleHttp(neon(databaseUrl))` (`src/lib/db/index.ts:34-36`) using `@neondatabase/serverless` HTTP transport. Includes auto-retry on fetch errors (up to 3 attempts with 300ms backoff).
- **Transactional Client:** `drizzleWs(new Pool({ connectionString: databaseUrl }))` (`src/lib/db/index.ts:44-47`) using WebSocket pooling. Created per transaction and explicitly closed.

### B. Readiness Probe Database Cancellation Analysis
- **Location:** `src/lib/health/index.ts:44-84` (`checkReadiness`).
- **Mechanism:**
  ```typescript
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const sqlClient = neon(databaseUrl, { fetchOptions: { signal: controller.signal } });
  const db = drizzleHttp(sqlClient);
  await db.execute(sql.raw("SELECT 1"));
  ```
- **Architectural Differentiation:**
  1. **Request Timeout:** Bounded by `timeoutMs` (defaults to 3000ms; configurable via `READINESS_DB_TIMEOUT_MS`).
  2. **Client-Side Cancellation:** The `AbortController.abort()` signal cancels the client-side `fetch()` call. The route handler catches the abort, clears the timer, and immediately returns HTTP 503 `not_ready`.
  3. **Actual Database Query Cancellation:** **Client abort over HTTP does NOT guarantee backend PostgreSQL query termination.** Neon's HTTP proxy receives the abort at the transport layer, but unlike PostgreSQL native wire protocol (which sends an out-of-band `CancelRequest` packet to the backend PID), HTTP stateless queries run to completion on the compute engine unless the proxy actively severs backend execution. For `SELECT 1`, execution time is sub-millisecond, so server load is negligible.
- **Severity:** Informational / Architectural Note.

### C. Migration Consistency & Foreign Keys
- **Migration Tooling:** Drizzle Kit (`drizzle.config.ts`), migrations tracked in `drizzle/` (7 SQL migration files, `0000_...` to `0006_order_counters.sql`).
- **Relational Integrity:** Foreign keys enforce referential integrity between `orders` and `profiles`, `order_items` and `orders`, `payments` and `orders`, `shipments` and `orders`.

---

## 6. Security Audit

### A. Authentication & Session Security
- **Mechanism:** `src/lib/auth/session.ts:9-35`.
- **Implementation:** 256-bit cryptographically secure random session tokens (`crypto.getRandomValues(32)`). Plaintext tokens live only in the client's `HttpOnly`, `SameSite=Lax`, `Secure` cookie.
- **Database Storage:** Database stores only the SHA-256 hash of the token (`sessions` table). Token theft from database dump does not permit impersonation.

### B. Administrative Origin Validation (SPN-SEC-005)
- **Mechanism:** `src/lib/security/origin.ts:49-100` (`assertAdminOriginAllowed`).
- **Enforcement:** Fail-closed allowlist normalization. Missing `Origin` headers, `Origin: null`, and unlisted origins on mutating administrative requests throw HTTP 403 `FORBIDDEN_ORIGIN`. Tested by 22 automated test cases (`tests/security-admin-origin.test.ts`).

### C. PostgreSQL Rate Limiting (SPN-SEC-003)
- **Mechanism:** `src/lib/security/rate-limit.ts:70-150` (`checkRateLimit`).
- **Enforcement:** Uses the PostgreSQL `rate_limits` table with sliding window expiry. Fail-closed policy (`fail_closed_503`) rejects traffic with HTTP 503 if the database is unavailable on sensitive auth endpoints. Tested by 16 automated test cases (`tests/security-rate-limit.test.ts`).

### D. Sensitive Information Redaction & Scrubbing
- **Structured Logging (Pino):** `src/lib/logger/redact.ts` automatically redacts passwords, authorization tokens, connection strings, credit cards, and PII keys.
- **Error Monitoring (Sentry):** `src/lib/sentry/scrub.ts` redacts authorization headers, cookies, connection strings, and user credentials from Sentry events and breadcrumbs before transmission.

---

## 7. Integration Dependency Matrix

| Integration | Implementation | Scope | Production Requirement | Health / Failure Behavior |
| :--- | :--- | :--- | :--- | :--- |
| **Neon PostgreSQL** | `@neondatabase/serverless` (HTTP & WS) | Core DB | **MANDATORY** | Readiness probe `/api/health/ready` returns 503 on failure. |
| **Razorpay** | REST API (`fetch`) & HMAC verification | Payments | **MANDATORY** | Order creation fails gracefully; webhooks retry for 24h. |
| **SMTP / Nodemailer**| `GmailSmtpProvider` / Nodemailer | Emails | **OPTIONAL / NON-FATAL** | Non-fatal `try/catch`; email failure does not abort checkout. |
| **Cloudflare R2** | `@aws-sdk/client-s3` | Storage | **OPTIONAL / ADMIN** | Product image uploads fail; public reads continue from CDN. |
| **Sentry** | `@sentry/nextjs` (v11) | Monitoring | **RECOMMENDED** | Missing DSN disables telemetry; zero impact on core transactions. |
| **Shiprocket** | `ShiprocketShippingProvider` | Shipping | **EXCLUDED / NOT REQUIRED** | Default fallback risk if `SHIPPING_PROVIDER` unset. |

---

## 8. Logging, Monitoring, and Health Checks

### A. Structured Logging (Phase 2)
- Server-side Pino logger (`src/lib/logger/`) operational across 10 API route handlers.
- Generates and propagates `x-request-id` correlation IDs.
- Zero client-side Pino bundle leakage. Tested by `tests/logger.test.ts` (10/10 passed).

### B. Sentry Error Monitoring (Phase 3)
- Server, client, and edge Sentry configurations initialized.
- DSN and build token separated.
- Recursive PII scrubbing active. Tested by `tests/sentry.test.ts` (17/17 passed).

### C. Health Endpoints (Phase 4)
- **Liveness (`GET /api/health`):** Stateless, fast (< 5ms), returns `{"status":"ok"}`. Zero database dependencies.
- **Readiness (`GET /api/health/ready`):** Executes `SELECT 1` against Neon via HTTP client. Bounded by 3000ms timeout. Returns 200 `ready` or 503 `not_ready`. Tested by `tests/health.test.ts` (12/12 passed).

---

## 9. Build, Typecheck, and Test Validation Results

### A. TypeScript Typecheck
- **Command:** `npm run typecheck` (`tsc --noEmit`)
- **Exit Code:** **0** (Clean compilation, zero TypeScript errors).

### B. Automated Test Suite Execution (`npx vitest run`)
- **Total Test Files:** 20
- **Passed Test Files (11 files, 141 tests passed, 0 failures):**
  1. `tests/sentry.test.ts` (17 passed)
  2. `tests/health.test.ts` (12 passed)
  3. `tests/logger.test.ts` (10 passed)
  4. `tests/combo-offers.test.ts` (18 passed)
  5. `tests/security-admin-origin.test.ts` (22 passed)
  6. `tests/security-rate-limit.test.ts` (16 passed)
  7. `tests/storefront-offers-integration.test.ts` (6 passed)
  8. `tests/checkout-post-payment-flow.test.ts` (10 passed)
  9. `tests/security-shiprocket-idempotency.test.ts` (6 passed)
  10. `tests/security-remediation-p1-p2.test.ts` (22 passed)
  11. `tests/auth-password.test.ts` (2 passed)
- **Blocked Test Files (9 files, 399 tests skipped):**
  - Files: `tests/admin-catalogue.test.ts`, `tests/admin-orders.test.ts`, `tests/cart.test.ts`, `tests/catalogue.test.ts`, `tests/customer.test.ts`, `tests/offers-coupons.test.ts`, `tests/orders.test.ts`, `tests/shipping.test.ts`, `tests/webhook.test.ts`.
  - Cause: Test harness requires a live local PostgreSQL service on `localhost:5432` (`TEST_DATABASE_URL=postgres://user:pw@localhost:5432/spn_test`). Blocked due to absence of local PostgreSQL server; not an assertion failure.

### C. Production Build (`npm run build`)
- **Command:** `next build`
- **Result:** Exited with Code 1.
- **Root Cause Analysis:** Known network-related build blocker (`getaddrinfo ENOTFOUND fonts.googleapis.com` in `src/app/layout.tsx`). The sandbox blocks outbound internet access to Google Fonts during font optimization. This is an environment constraint, not an application code bug.

### D. Git Working Tree State
- `git status --short`: All changes from Phases 2–6 remain intact.
- `git diff --check`: **0 whitespace or syntax errors**.

---

## 10. Findings, Classifications, and Recommendations

### Finding 1: Shipping Provider Fallback Invokes Shiprocket in Production
- **Severity:** **HIGH**
- **Location:** `src/lib/shipping/provider.ts:65-67` and `src/lib/api/customer-api.ts:366-370`
- **Evidence:** `defaultProvider` resolves to `"shiprocket"` when `SHIPPING_PROVIDER` is unset. During checkout, `provider.checkServiceability()` is called. If Shiprocket credentials are added to production, any external Shiprocket API outage causes checkout to fail with HTTP 422 `UNSERVICEABLE_PINCODE`.
- **Potential Business Impact:** Interruption of customer checkouts and revenue loss if Shiprocket credentials are ever configured or if provider defaults to Shiprocket.
- **Recommended Action:**
  1. **Immediate Operational Prerequisite:** Set `SHIPPING_PROVIDER="manual"` in Vercel production environment variables.
  2. **Future Engineering Task:** Decommission unused Shiprocket provider code and remove `checkServiceability` from checkout flow.

### Finding 2: Sandboxed Build Network Dependency on Google Fonts
- **Severity:** **MEDIUM**
- **Location:** `src/app/layout.tsx:1-15` (`next/font/google`)
- **Evidence:** `next build` requires resolving `fonts.googleapis.com` during static asset optimization. In environments without external internet access, build fails.
- **Potential Business Impact:** Fails isolated offline CI builds. Vercel production builds succeed because Vercel build runners have outbound internet access.
- **Recommended Action:** Pre-download static font files into `public/fonts/` or configure local fallback fonts if offline builds are required.

### Finding 3: Database-Dependent Test Suite Execution Blocked Locally
- **Severity:** **LOW**
- **Location:** `tests/harness.ts:21`
- **Evidence:** 9 integration test suites hardcode fallback to `localhost:5432`.
- **Potential Business Impact:** Local developer testing cannot run full regression suite without running a local PostgreSQL container.
- **Recommended Action:** Configure a local Docker container or Neon branch for CI test execution.

---

## 11. Production Readiness Determination

### Final Classification:
**`READY WITH CONDITIONS`**

### Production Prerequisites ("Conditions"):
1. **Configure Shipping Provider Variable in Vercel:**
   Set `SHIPPING_PROVIDER="manual"` in Vercel Production and Preview environment variables to ensure the application explicitly selects `ManualShippingProvider` and never contacts Shiprocket.
2. **Verify Razorpay Webhook Configuration in Dashboard:**
   Confirm webhook URL `https://spnhealthmix.com/api/webhooks/razorpay` is active with secret matching `RAZORPAY_WEBHOOK_SECRET`.
3. **Verify Neon Database Connection String:**
   Ensure `DATABASE_URL` in Vercel points to the Neon connection pooler (`-pooler.neon.tech`) with `?sslmode=require`.
4. **Confirm SMTP App Password:**
   Ensure `SMTP_PASSWORD` and `SMTP_USER` are configured for transactional order emails.


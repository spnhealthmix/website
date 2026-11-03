# SPN Health Mix – Production Secrets & Credential Inventory

This document provides a comprehensive inventory of all environment variables, authentication secrets, API keys, and operational configuration used across the SPN Health Mix application.

> [!IMPORTANT]
> **Zero Exposure Policy:**
> This inventory catalogs credential names, dependencies, lifecycles, and risk classifications. **No actual secret values, tokens, connection strings, or passwords are recorded in this document or tracked in Git.**

---

## 1. Active Credential & Configuration Inventory

The following credentials and configurations are required for active SPN Health Mix production operations:

| Provider | Variable Name | Purpose / Scope | Consumed At | Environment Scope | Credential Type & Risk | Rotation Readiness |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Neon** | `DATABASE_URL` | PostgreSQL connection string (serverless HTTP stateless & WebSocket pool) | `src/lib/api/deps.ts`<br>`src/lib/db/index.ts`<br>`drizzle.config.ts`<br>`scripts/create-admin.ts` | Server-only (Prod & Preview) | **CRITICAL SECRET** (Private database access) | **HIGH RISK** |
| **Neon** | `TEST_DATABASE_URL` | Integration test database connection string | `tests/harness.ts`<br>`tests/customer.test.ts`<br>`tests/orders.test.ts` | Development / Test only | Non-production test credential | **READY** |
| **Razorpay** | `RAZORPAY_KEY_ID` | Server API authentication identifier | `src/lib/api/deps.ts`<br>`src/app/api/admin/[...slug]/route.ts` | Server-only | Public Identifier (Restricted) | **READY** |
| **Razorpay** | `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Client-side Razorpay Checkout.js modal initialization | `src/lib/api/deps.ts`<br>`src/components/checkout/checkout-form.tsx` | Client Bundle (Browser) | Public Identifier (Client-visible) | **READY** |
| **Razorpay** | `RAZORPAY_KEY_SECRET` | Basic auth API secret for order creation & payment signature verification | `src/lib/api/deps.ts`<br>`src/lib/payments/razorpay.ts`<br>`src/lib/payments/signature.ts` | Server-only | **CRITICAL SECRET** (Private financial gateway secret) | **HIGH RISK** |
| **Razorpay** | `RAZORPAY_WEBHOOK_SECRET` | HMAC SHA-256 signature verification for inbound payment webhooks | `src/app/api/webhooks/razorpay/route.ts`<br>`src/lib/payments/webhook.ts` | Server-only | **HIGH SECRET** (Private webhook verification secret) | **NEEDS PREPARATION** |
| **Email (SMTP)** | `EMAIL_ENABLED` | Master switch for transactional email dispatch (`true` \| `false`) | `src/lib/email/provider.ts` | Server-only | Operational Flag (Non-secret) | **READY** |
| **Email (SMTP)** | `SMTP_USER` | SMTP username / sender account email | `src/lib/email/provider.ts` | Server-only | Confidential Identifier | **READY** |
| **Email (SMTP)** | `SMTP_PASSWORD` | SMTP application password / token | `src/lib/email/provider.ts` | Server-only | **HIGH SECRET** (Private mail credential) | **NEEDS PREPARATION** |
| **Email (SMTP)** | `SMTP_HOST` | SMTP server hostname (default: `smtp.gmail.com`) | `src/lib/email/provider.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Email (SMTP)** | `SMTP_PORT` | SMTP server port (default: `587`) | `src/lib/email/provider.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Email (SMTP)** | `EMAIL_FROM` | Default outgoing sender address | `src/lib/email/provider.ts`<br>`src/lib/email/templates/base.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Email (SMTP)** | `EMAIL_REPLY_TO` | Customer reply address | `src/lib/email/provider.ts`<br>`src/lib/email/templates/base.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Email (SMTP)** | `SMTP_RELAY_URL` | Optional HTTP SMTP relay proxy URL | `src/lib/email/provider.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Cloudflare R2** | `R2_ACCOUNT_ID` | Cloudflare account identifier for S3 endpoint construction | `src/lib/storage/storage.ts`<br>`scripts/sync-images-to-r2.ts` | Server-only | Account Identifier (Non-secret) | **READY** |
| **Cloudflare R2** | `R2_ACCESS_KEY_ID` | S3-compatible API access key ID | `src/lib/storage/storage.ts`<br>`scripts/sync-images-to-r2.ts` | Server-only | Restricted Identifier | **READY** |
| **Cloudflare R2** | `R2_SECRET_ACCESS_KEY` | S3-compatible API secret access key | `src/lib/storage/storage.ts`<br>`scripts/sync-images-to-r2.ts` | Server-only | **CRITICAL SECRET** (Private storage access) | **NEEDS PREPARATION** |
| **Cloudflare R2** | `R2_BUCKET_NAME` | Target R2 bucket name | `src/lib/storage/storage.ts`<br>`scripts/sync-images-to-r2.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Cloudflare R2** | `R2_PUBLIC_BASE_URL` | Public CDN base URL for serving product images | `src/lib/api/deps.ts`<br>`src/app/api/admin/[...slug]/route.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **Cloudflare R2** | `NEXT_PUBLIC_R2_PUBLIC_BASE_URL` | Client-accessible image CDN URL | `src/components/checkout/checkout-form.tsx` | Client Bundle (Browser) | Public Configuration | **READY** |
| **Sentry** | `SENTRY_DSN` | Server-side & Edge telemetry ingestion endpoint URL | `sentry.server.config.ts`<br>`sentry.edge.config.ts` | Server & Edge | Ingestion Identifier (Public telemetry key) | **READY** |
| **Sentry** | `NEXT_PUBLIC_SENTRY_DSN` | Client-side (browser) telemetry ingestion endpoint URL | `sentry.client.config.ts` | Client Bundle (Browser) | Ingestion Identifier (Public telemetry key) | **READY** |
| **Sentry** | `SENTRY_AUTH_TOKEN` | Private build-time sourcemap upload token | `next.config.ts` (via `@sentry/nextjs`) | Build-time CI/CD only | **HIGH SECRET** (Private build credential) | **READY** |
| **Sentry** | `SENTRY_ORG` | Sentry organization slug | `next.config.ts` | Build-time CI/CD | Public Identifier | **READY** |
| **Sentry** | `SENTRY_PROJECT` | Sentry project slug | `next.config.ts` | Build-time CI/CD | Public Identifier | **READY** |
| **App Security** | `APP_ORIGINS` | Permitted browser origins allowlist | `src/lib/api/deps.ts`<br>`src/lib/security/origin.ts` | Server-only | Configuration (Non-secret) | **READY** |
| **App Security** | `NEXT_PUBLIC_SITE_URL` | Storefront public base URL | `src/app/layout.tsx` | Client Bundle (Browser) | Public Configuration | **READY** |

---

## 2. Active Provider Architecture & Dependencies

### A. Neon PostgreSQL (`DATABASE_URL`)
- **Connection Mechanics:**
  - Stateless reads and single-statement operations: `neon(databaseUrl)` via `drizzle-orm/neon-http`.
  - Transactional operations (orders, checkout, stock decrements): `new Pool({ connectionString: databaseUrl })` via `drizzle-orm/neon-serverless` WebSockets.
  - CLI Migrations: `drizzle-kit migrate` via standard Node `pg` client.
- **Dependencies:** Core database storing catalog, product variants, orders, payments, coupons, customer profiles, rate-limiting counters, and session hashes.
- **Rotation Impact:**
  - Modifying `DATABASE_URL` immediately breaks active database connections if credentials are invalid.
  - Zero-downtime rotation cannot be assumed unless a secondary database role is provisioned and verified in Neon prior to repointing Vercel.

### B. Razorpay (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`)
- **Order Creation:** Uses HTTP Basic Auth (`Authorization: Basic btoa(keyId:keySecret)`).
- **Payment Verification:** Server-side HMAC SHA-256 verification of `order_id|payment_id` against `RAZORPAY_KEY_SECRET`.
- **Webhook Processing:** Inbound payment webhooks to `/api/webhooks/razorpay` require HMAC SHA-256 signature verification using `RAZORPAY_WEBHOOK_SECRET`.
- **Client Exposure:** `RAZORPAY_KEY_ID` is passed to the browser for Checkout.js modal initialization. `RAZORPAY_KEY_SECRET` and `RAZORPAY_WEBHOOK_SECRET` are strictly server-side.
- **Independence:** API credential rotation (`KEY_ID` / `KEY_SECRET`) and webhook secret rotation (`WEBHOOK_SECRET`) are separate operations in the Razorpay Dashboard.

### C. Email Infrastructure (SMTP / Nodemailer)
- **Verified Codebase Finding:** Transactional email is implemented using **Nodemailer SMTP** (`src/lib/email/provider.ts` and `src/lib/email/smtp.ts`), configurable via `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_HOST`, and `SMTP_PORT`.
- **Provider Status:** The codebase defaults to `smtp.gmail.com` if `SMTP_HOST` is omitted, but can target any standard SMTP relay. (Resend is not installed or referenced in the codebase).
- **Fault Tolerance:** Email dispatches are wrapped in non-fatal `try/catch` handlers. Email delivery failures log warnings to Sentry but do not rollback database transactions or abort checkout.

### D. Cloudflare R2 / S3 Storage (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`)
- **Implementation:** Uses `@aws-sdk/client-s3` targeting `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`.
- **Operations:** Server-side `PutObjectCommand` for product image uploads and `DeleteObjectsCommand` for deletions.
- **Public Serving:** Images are served publicly via `R2_PUBLIC_BASE_URL` or `NEXT_PUBLIC_R2_PUBLIC_BASE_URL`.
- **Asset Persistence:** Existing uploaded images are addressed by object keys and remain intact regardless of API credential rotation.

### E. Sentry Telemetry & Sourcemaps (`SENTRY_DSN`, `SENTRY_AUTH_TOKEN`)
- **Telemetry Ingestion (Public):** `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` are event ingestion endpoints, not authentication secrets. They do not grant administrative access to Sentry project data.
- **Sourcemap Upload (Private):** `SENTRY_AUTH_TOKEN` is a confidential build-time token used exclusively during CI/CD or `next build` to upload sourcemaps. It is never bundled into client-side JavaScript or serverless runtime functions.

---

## 3. Legacy Integration – Not Required for Current SPN Health Mix Operations

The following integration references exist in the current codebase but are **not required** for active SPN Health Mix business operations:

### Shiprocket Shipping Integration
- **Referenced Variables:**
  - `SHIPROCKET_EMAIL`
  - `SHIPROCKET_PASSWORD`
  - `SHIPROCKET_WEBHOOK_SECRET`
  - `SHIPROCKET_BASE_URL`
  - `SHIPPING_ORIGIN_PINCODE`
  - `SHIPPING_PROVIDER`
- **Code Locations:**
  - `src/lib/shipping/shiprocket.ts` (Shiprocket API client & 9-day in-memory token cache)
  - `src/lib/shipping/provider.ts` (Provider registry with mock / manual fallback)
  - `src/app/api/webhooks/shipping/route.ts` (Inbound shipping webhook endpoint)
- **Status & Policy:**
  - **Exclusion from Scope:** Shiprocket is excluded from the active credential rotation scope, operational monitoring, and disaster recovery requirements.
  - **Code Preservation:** In accordance with audit constraints, Shiprocket source code, routes, and migrations are preserved as-is.
  - **Cleanup Recommendation:** A future, separately approved cleanup task should remove the unused Shiprocket code, routes, and test dependencies.
  - **Environment Variables:** Their active presence in production Vercel project settings is unconfirmed and should be audited in the Vercel console.

---

## 4. Git Tracking & Secret Exposure Audit Findings

1. **`.env` File Safety:**
   - `.env` is explicitly ignored in `.gitignore` (line 27).
   - `.env` is **NOT** tracked by Git (`git ls-files .env` returns empty).
   - `git log --all -- .env` confirms `.env` was **never committed** to repository history.
2. **`.env.example` Hygiene:**
   - `.env.example` is tracked by Git, but contains **zero real secrets or credentials** (only variable keys with empty or placeholder values).
3. **Hardcoded Secrets in Source Code:**
   - A complete regex scan across `src/` for hardcoded connection strings (`postgres://`, `postgresql://`), live Razorpay keys (`rzp_live_*`), or bearer tokens returned **zero real credentials**.
4. **Test Fixtures:**
   - Dummy connection strings (`postgresql://user:pass@localhost:5432/db`) and dummy keys (`rzp_live_secret_key_12345`) exist strictly within test files (`tests/logger.test.ts`, `tests/sentry.test.ts`) to verify redaction and scrubbing.
5. **Client-Side Bundle Exposure:**
   - No private secret (`DATABASE_URL`, `RAZORPAY_KEY_SECRET`, `SMTP_PASSWORD`, `R2_SECRET_ACCESS_KEY`) is prefixed with `NEXT_PUBLIC_` or imported into client components.

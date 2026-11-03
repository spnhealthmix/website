# SPN Health Mix – Production Secret Rotation Runbook

This runbook provides step-by-step, provider-specific operational procedures for rotating active credentials in the SPN Health Mix application without causing unplanned downtime, payment disruption, or data desynchronization.

> [!CAUTION]
> **READ-ONLY AUDIT NOTICE:**
> This runbook defines operational instructions for future authorized rotations. **Do not execute any rotation during an audit phase.** All rotations require prior written sign-off according to `docs/SECRET-ROTATION-POLICY.md`.

---

## 1. Pre-Rotation General Checklist

Before rotating any production credential, verify the following:
- [ ] No active customer checkout surge or high-traffic sale event is underway.
- [ ] Liveness probe (`GET /api/health`) and readiness probe (`GET /api/health/ready`) return HTTP 200.
- [ ] Dual authorization has been formally recorded in the incident/change ledger.
- [ ] A backup of the current environment variable configuration (names and metadata only, never raw secrets) is recorded.
- [ ] Operator has access to Vercel Project Settings, GitHub repository, and the respective provider dashboard.
- [ ] A contingency rollback plan is prepared in case the new credential fails verification.

---

## 2. Neon PostgreSQL (`DATABASE_URL`) Rotation Runbook

### Overview & Operational Risks
- `DATABASE_URL` connects serverless Next.js functions via `@neondatabase/serverless` using HTTP for stateless queries and WebSockets for transactions (`Pool`).
- **Risk Assessment (HIGH RISK):** Replacing `DATABASE_URL` terminates active database connections if credentials are invalid or if the database user permissions differ. **Zero-downtime rotation cannot be assumed** unless a secondary database role is verified prior to repointing Vercel.

### Step-by-Step Rotation:
1. **Identify Database Dependencies:**
   - Review both `Production` and `Preview` environment variables in Vercel to confirm whether preview deployments share or isolate the production database.
2. **Verify Role Creation Capability in Neon:**
   - In Neon Console > **Roles / Users**, verify whether account permissions permit creating a new secondary role (e.g., `spn_app_v2`).
   - If secondary roles are supported: Create `spn_app_v2`, generate a new secure password, and grant schema permissions:
     ```sql
     GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO spn_app_v2;
     GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO spn_app_v2;
     ```
   - If secondary roles are not supported (e.g. managed single-owner instance): Plan for an immediate coordinated password replacement during an approved maintenance window.
3. **Test New Connection URL Independently:**
   - Construct the new connection string targeting the pooled endpoint:
     `postgresql://[ROLE]:[PASSWORD]@ep-xxx-pooler.neon.tech/neondb?sslmode=require`
   - Test connectivity from an administrative terminal or CI worker without touching production:
     ```bash
     psql "postgresql://[ROLE]:[PASSWORD]@ep-xxx-pooler.neon.tech/neondb?sslmode=require" -c "SELECT 1;"
     ```
4. **Coordinate Vercel Environment Configuration:**
   - Open Vercel Dashboard > **Settings** > **Environment Variables**.
   - Edit `DATABASE_URL` for `Production` (and `Preview` if applicable).
   - Enter the verified connection string and click **Save**.
5. **Redeploy Application:**
   - Serverless worker instances with warm connection pools will not pick up new environment variables automatically. Trigger a production redeployment:
     ```bash
     vercel redeploy <LATEST_DEPLOYMENT_ID>
     ```
6. **Verify Database Readiness & Monitor Connectivity:**
   - Query the readiness endpoint:
     ```bash
     curl -i https://spnhealthmix.com/api/health/ready
     # Must return HTTP 200 {"status":"ready","checks":{"database":"ok"}}
     ```
   - Monitor Sentry and Pino structured logs for connection errors or pool exhaustion over a 30-minute observation window.
7. **Contingency Rollback Path:**
   - If `/api/health/ready` returns 503 or error rates rise, immediately restore the previous known-good `DATABASE_URL` in Vercel and redeploy.
8. **Revoke Old Credential (Requires Explicit Approval):**
   - Retain the old role/credential in a disabled or dormant state for at least 24 hours.
   - Only after explicit sign-off from the Lead DBA, delete or revoke the old role in the Neon Console.

---

## 3. Razorpay Credentials Rotation Runbook

Razorpay uses three separate credentials that must be managed independently:
- `RAZORPAY_KEY_ID`: Client and server API identifier.
- `RAZORPAY_KEY_SECRET`: Private server-side API basic auth secret.
- `RAZORPAY_WEBHOOK_SECRET`: HMAC SHA-256 signature verification secret for incoming webhooks.

### A. Rotating API Keys (`RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`)

> [!WARNING]
> **Provider Overlapping-Key Support is Unverified:**
> Do not assume Razorpay automatically keeps the old key active for 24 hours unless explicitly confirmed in your specific merchant account settings. If the account only supports immediate key replacement, schedule the rotation during minimum-traffic windows.

1. **Pre-Check & Dual Authorization:**
   - Confirm written sign-off from the **Incident Commander** and **Financial Lead**.
   - Confirm no active checkouts are in-flight.
2. **Generate New Key Pair in Razorpay Dashboard:**
   - Navigate to Razorpay Dashboard > **Settings** > **API Keys**.
   - Generate a new key pair. Check whether your dashboard offers an overlapping grace period ("Keep old key active for 24 hours").
   - Record the new `Key ID` and `Key Secret` in your secure password manager.
3. **Update Vercel Environment Variables:**
   - Update `RAZORPAY_KEY_ID` in Vercel Project Settings.
   - Update `NEXT_PUBLIC_RAZORPAY_KEY_ID` (so client bundles receive the new Key ID).
   - Update `RAZORPAY_KEY_SECRET` in Vercel.
4. **Redeploy Vercel Application:**
   - Trigger a production deployment so Next.js rebuilds client bundles with the new public key:
     ```bash
     vercel redeploy --prod
     ```
5. **Verify Payment Initialization & Verification:**
   - Test `/api/checkout/initiate` in staging or using a test transaction to verify that Razorpay accepts the credentials and returns a valid `razorpayOrderId`.
   - Verify payment signature verification passes without error.
6. **Contingency Plan:**
   - If checkout fails, immediately revert Vercel environment variables to the previous key pair (if not yet revoked at Razorpay) and redeploy.
7. **Deactivate Old Key:**
   - If an overlapping grace period was used, deactivate the old key in the Razorpay Dashboard after confirming successful live payments.

### B. Rotating Webhook Secret (`RAZORPAY_WEBHOOK_SECRET`)
API key rotation and webhook secret rotation are **completely separate operations**:
1. In Razorpay Dashboard > **Settings** > **Webhooks**.
2. Select the webhook endpoint targeting `https://spnhealthmix.com/api/webhooks/razorpay`.
3. Generate a new cryptographically random secret (e.g. `openssl rand -hex 32`).
4. Update the webhook secret in the Razorpay Dashboard and in Vercel (`RAZORPAY_WEBHOOK_SECRET`).
5. Redeploy Vercel. Inbound webhooks that fail signature verification will return HTTP 400. Razorpay automatically retries failed deliveries per merchant configuration.

---

## 4. Email Infrastructure Rotation Runbook (SMTP / Nodemailer)

The application currently uses **Nodemailer SMTP** (`src/lib/email/provider.ts` and `src/lib/email/smtp.ts`). (Resend is not installed or configured).

### Rotating SMTP Password (`SMTP_PASSWORD`)
1. **Generate New App Password at Mail Provider:**
   - For Gmail / Google Workspace SMTP: Log in to Google Account > **Security** > **2-Step Verification** > **App Passwords**.
   - Generate a new App Password labeled "SPN Health Mix Production".
2. **Update Vercel Environment Variables:**
   - Update `SMTP_PASSWORD` (and `SMTP_USER` if the sending account changed) in Vercel Project Settings.
3. **Redeploy Application:**
   - Redeploy production to refresh serverless workers.
4. **Verify Transactional Dispatch:**
   - Trigger a controlled transactional email flow (e.g. a customer password reset request via `/api/auth/forgot-password`).
   - Confirm receipt in the recipient inbox.
5. **Revoke Old App Password:**
   - In Google Account Security, revoke the old App Password.

---

## 5. Cloudflare R2 / S3 Storage Rotation Runbook

### Key Architecture & Image Preservation
- Existing uploaded images are addressed by permanent object keys and served publicly via `R2_PUBLIC_BASE_URL`.
- **Rotating API credentials does NOT alter, overwrite, or delete existing stored product images.**

### Step-by-Step Rotation:
1. **Verify Multi-Token Support in Cloudflare:**
   - Log in to Cloudflare Dashboard > **R2** > **Manage R2 API Tokens**.
   - Verify whether account permissions allow creating multiple active API tokens.
2. **Create New API Token:**
   - Click **Create API Token**.
   - Permissions: **Object Read & Write** scoped strictly to bucket `spn-images`.
   - Copy the new `Access Key ID` and `Secret Access Key`.
3. **Update Vercel Environment Variables:**
   - Update `R2_ACCESS_KEY_ID` and `R2_SECRET_ACCESS_KEY` in Vercel.
   - Do **not** modify `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, or `R2_PUBLIC_BASE_URL` unless the storage bucket itself was migrated.
4. **Redeploy Application:**
   - Redeploy production via Vercel.
5. **Verify Storage Operations (Upload, Read, Delete):**
   - Run a test upload via the admin catalogue interface or execute `scripts/sync-images-to-r2.ts` in single-file test mode.
   - Confirm that newly uploaded assets are readable from `R2_PUBLIC_BASE_URL`.
   - Confirm that existing product images continue to render on storefront product pages.
6. **Revoke Old Cloudflare API Token:**
   - After confirming storage operations, delete the old API token in the Cloudflare Dashboard.

---

## 6. Sentry Error Monitoring Rotation Runbook

### Credential Classification
- `SENTRY_DSN` & `NEXT_PUBLIC_SENTRY_DSN`: Public event ingestion endpoints. They do not grant access to view errors or modify project settings.
- `SENTRY_AUTH_TOKEN`: Private build-time credential used strictly by `@sentry/nextjs` during `next build` to upload sourcemaps.

### A. Ingestion DSN Rotation (`SENTRY_DSN` & `NEXT_PUBLIC_SENTRY_DSN`)
Only necessary if the public DSN is flooded with spam or abused:
1. In Sentry Dashboard > **Settings** > **Projects** > **Client Keys (DSN)**.
2. Create a new Client Key.
3. Update `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in Vercel.
4. Redeploy production. Verify telemetry is received in the Sentry stream.
5. Disable the old Client Key in Sentry after 24 hours.

### B. Sourcemap Build Token Rotation (`SENTRY_AUTH_TOKEN`)
1. In Sentry Dashboard > **Settings** > **Auth Tokens**.
2. Create a new token with `project:releases` and `org:read` permissions.
3. Update `SENTRY_AUTH_TOKEN` in Vercel Project Settings (scoped to Build environment).
4. Run a preview deployment to verify that sourcemaps upload cleanly without build errors.
5. Revoke the old token in the Sentry Dashboard.

---

## 7. Legacy Integration – Not Required for Current SPN Health Mix Operations

### Shiprocket Credentials
- **Variables:** `SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_SECRET`.
- **Policy:** Shiprocket is **not required** for current SPN Health Mix website operations. Its credentials are excluded from active operational rotation procedures.
- **Runbook Guidance:** Operators must not perform routine rotation on Shiprocket credentials. A separate code cleanup task will be scheduled to decommission the unused shipping client and routes.

---

## 8. Rollback Procedures for Failed Rotations

If any rotated credential fails functional validation:
1. **Immediate Reversion:** Revert the environment variable in Vercel Project Settings to the previous known-good credential (which must not be revoked until validation succeeds).
2. **Redeploy Immediately:**
   ```bash
   vercel redeploy --prod
   ```
3. **Verify Health:** Confirm `/api/health/ready` returns 200.
4. **Incident Logging:** Log the failure root cause in the rotation audit ledger.

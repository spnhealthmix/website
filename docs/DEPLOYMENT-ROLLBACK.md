# SPN Health Mix – Production Deployment Rollback Plan

This runbook defines the operational procedures, decision criteria, technical mechanics, and verification steps for rolling back deployments of the SPN Health Mix application on Vercel.

---

## 1. Architecture & Operational Baseline

The SPN Health Mix application operates under the following production architecture:

- **Hosting & Compute:** Vercel Serverless Functions running Next.js 15 App Router (Node.js runtime).
- **Database:** Neon Serverless PostgreSQL managed via Drizzle ORM.
- **Payment Processing:** Razorpay (synchronous checkout initialization and asynchronous webhook reconciliation).
- **Shipping Logistics:** Shiprocket API integration and webhooks.
- **Transactional Email:** Resend API integration.
- **Media & Asset Storage:** Cloudflare R2 / S3-compatible storage.
- **Observability:** Pino structured JSON logging (with `x-request-id` correlation) and Sentry error monitoring.
- **Health Verification:**
  - `GET /api/health` (Liveness probe – process responsiveness)
  - `GET /api/health/ready` (Readiness probe – database connectivity and query execution)

---

## 2. Incident Classification & Severity Levels

When an operational anomaly or deployment regression occurs, classify the incident immediately:

| Severity Level | Definition | Impact Examples | Action Window (Target) | Primary Remediation |
| :--- | :--- | :--- | :--- | :--- |
| **SEV-1 (Critical)** | Core revenue or customer journey completely blocked; widespread system failure. | - 5xx errors on checkout initialization (`/api/checkout/initiate`)<br>- Payment verification failure (`/api/checkout/verify`)<br>- Database connectivity failure across all routes<br>- SSR application crash on homepage or product pages | **Target: < 15 minutes** | Vercel Rollback (if DB schema is compatible) OR Database failover |
| **SEV-2 (Major)** | Secondary user journey broken; degraded performance; partial feature outage. | - Order history or account profile rendering errors<br>- Webhook processing failure (events queueing or returning 500)<br>- Search or filter failures on catalog | **Target: < 60 minutes** | Hotfix deployment OR Rollback after impact assessment |
| **SEV-3 (Minor)** | Non-critical operational friction; background asynchronous task failure. | - Transactional email delivery delay (Resend rate limits or outage)<br>- Shipping status update delay (Shiprocket webhook delay)<br>- Admin analytics calculation error | **Next business day / Standard sprint** | Forward-fix via normal CI/CD pipeline |

---

## 3. Rollback Conditions & Downtime Expectations

### When to Roll Back
Rollback is the primary remediation action when:
1. A new deployment introduces syntax errors, runtime exceptions, or 500 error spikes visible in Sentry and Vercel logs.
2. The liveness probe (`GET /api/health`) or core application routes return HTTP 500/502/504 immediately following a production deployment.
3. Critical regression in checkout, cart, or payment initialization cannot be resolved with an immediate configuration fix.
4. Memory exhaustion, CPU throttling, or severe cold-start degradation occurs on serverless functions.

### When NOT to Roll Back Code
Do **not** roll back application code in Vercel if:
1. **The outage is caused by an external dependency:** Neon PostgreSQL is down, Razorpay API is returning 5xx globally, or Cloudflare/Resend is experiencing an outage. Rolling back application code will not restore third-party services and introduces needless deployment volatility.
2. **A database schema migration has broken backward compatibility:** If a migration dropped a column or introduced non-null constraints that the previous deployment's code does not satisfy, rolling back code will cause old code to crash against the new schema (see Section 5).
3. **The issue is a missing or invalid environment variable:** Update the environment variable directly in the Vercel Project Settings and trigger a redeployment of the current release.

### Downtime Expectations & Rollback Mechanics
- **Vercel Rollback Mechanics:** Vercel rollback can restore a previous deployment without rebuilding the application. Actual traffic recovery time depends on deployment configuration, edge propagation and client behavior. No guaranteed rollback duration is established. (Unverified operational target estimate: < 15 seconds for edge routing re-aliasing).
- **In-Flight Requests:** Active HTTP requests are allowed to complete on their executing serverless instances. Subsequent requests are routed to the designated target deployment.

---

## 4. Step-by-Step Vercel Rollback Procedure

### Step 1: Detect and Confirm the Issue
1. **Inspect Health Endpoints:**
   ```bash
   # Test liveness probe
   curl -I https://spnhealthmix.com/api/health
   # Expected: HTTP/1.1 200 OK {"status":"ok"}

   # Test readiness probe
   curl -I https://spnhealthmix.com/api/health/ready
   # Expected: HTTP/1.1 200 OK {"status":"ready","checks":{"database":"ok"}}
   ```
2. **Inspect Sentry Alerts:**
   - Open Sentry Dashboard > **Issues**.
   - Filter by `release:<current_release_tag>`.
   - Identify unhandled exceptions, failure rates, and affected route paths.
3. **Inspect Vercel Runtime Logs:**
   - Open Vercel Dashboard > **Project** > **Logs**.
   - Filter by status `500` or query for error logs.
   - Note the `request_id` from the structured Pino log:
     ```json
     {"level":50,"time":"2026-11-03T14:32:01.120Z","request_id":"req_abc123","err":{"message":"..."}}
     ```

### Step 2: Identify the Last-Known-Good Deployment
1. Navigate to **Deployments** in the Vercel Dashboard.
2. Identify the last deployment marked **Ready** that was active in production prior to the incident release.
3. Check the commit hash of that deployment in GitHub to ensure it does not have known critical bugs.
4. Note the deployment URL (e.g., `spn-foods-git-main-oldhash.vercel.app`).

### Step 3: Check Database Migration Safety
Before triggering the rollback, answer this critical question:
> **Did the failing deployment execute a database schema migration?**
- Check the `drizzle/` directory in the failing release's git diff.
- If **NO migrations** were applied: Proceed immediately to Step 4 (Execute Vercel Rollback).
- If **migrations WERE applied**: Follow Section 5 ("Database & Code Desynchronization") before touching Vercel.

### Step 4: Execute Vercel Rollback

#### Method A: Via Vercel Web Dashboard (Recommended)
1. In the Vercel Dashboard, navigate to the **Deployments** tab.
2. Locate the last-known-good deployment.
3. Click the **three dots menu (`...`)** on the right side of the deployment entry.
4. Select **Instant Rollback** (or **Promote to Production**).
5. Review the confirmation modal and click **Confirm Rollback**.
6. The production domain (`spnhealthmix.com`) will be re-aliased to this deployment. (Edge routing re-aliasing target is under 1 minute; actual client convergence depends on DNS and edge propagation).

#### Method B: Via Vercel CLI
If the web dashboard is unreachable:
```bash
# 1. Log in to Vercel
vercel login

# 2. List recent deployments to find the target deployment URL or ID
vercel ls --prod

# 3. Rollback production to the specific deployment
vercel rollback <DEPLOYMENT_URL_OR_ID>

# Alternatively, manually alias the deployment to production:
vercel alias <DEPLOYMENT_URL_OR_ID> spnhealthmix.com
```

### Step 5: Verify Environment Variables
1. Navigate to **Project Settings** > **Environment Variables** in Vercel.
2. Confirm that environment variables have not been modified in a way that breaks the older code:
   - Check `DATABASE_URL` (must still point to the valid Neon connection).
   - Check `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
   - Check `NEXT_PUBLIC_APP_URL` and `SENTRY_DSN`.
3. If environment variables were altered during the failed deployment, revert them to the values required by the rolled-back deployment. Note: Updating environment variables requires a new deployment or re-deployment of the rolled-back commit to pick up changed values.

### Step 6: Verify Routing & Edge CDN Propagation
1. Verify DNS and Edge routing:
   ```bash
   curl -s -D - https://spnhealthmix.com/api/health -o /dev/null
   ```
2. Confirm the `x-vercel-id` header reflects the target region and status code is `200`.
3. Purge edge cache if static assets or ISR pages are serving cached error pages.

### Step 7: Execute Post-Rollback Smoke Test
Execute the verification checklist in Section 9 immediately.

---

## 5. Code-vs-Database Desynchronization Risks & Compatibility Policy

### The Desynchronization Dilemma
A code rollback in Vercel **only changes application code**. It does **not** revert the Neon PostgreSQL database schema or data.

```
+-----------------------------------------------------------+
| Vercel Code: Rolled back to Version N-1                   |
| Neon Database: Remains at Version N (Migration applied)   |
+-----------------------------------------------------------+
```

If Version N migration altered the database in a backward-incompatible way:
- Old code attempting to insert without newly required columns will fail (`NOT NULL violation`).
- Old code attempting to query a renamed or dropped column will fail (`UndefinedColumn error`).
- Old code writing to schema assuming old constraints may corrupt data.

### Database Migration Compatibility Policy ("Expand and Contract")
All database migrations in SPN Health Mix must follow the **Expand and Contract** pattern so that code can always be safely rolled back:

1. **Phase 1: Expand (Safe to Roll Back)**
   - New columns must be **nullable** or have **server-level defaults** (`DEFAULT ...`).
   - New tables can be added freely.
   - New indexes can be added.
   - Code is updated to read from new columns while writing to both old and new.
   - *Rollback impact:* Safe. Old code ignores new columns and new tables.

2. **Phase 2: Migrate / Backfill (Safe to Roll Back)**
   - Data is backfilled from old columns to new columns asynchronously.
   - Application code is updated to rely primarily on new columns.
   - *Rollback impact:* Safe.

3. **Phase 3: Contract (Destructive – Requires Pre-Validation)**
   - Old columns or old tables are dropped.
   - `NOT NULL` constraints are applied to new columns.
   - **Recommended Operational Policy (Soak Period):** A Contract migration should NEVER be deployed in the same release as the code using it. As a recommended operational policy (not an automated tool constraint enforced by Vercel, Neon, or Drizzle), it should only be deployed after the new code has run stably in production for at least 48 hours to confirm zero regressions.
   - *Rollback impact:* Destructive. Old code cannot run against a contracted schema.

### Handling Rollback When Migration Was Incompatible
If an incompatible migration has already been executed on Neon:
1. **Do not execute an instant code rollback.**
2. **Option A (Roll-Forward Hotfix - Preferred):** Write a fix in the current code branch, build, and deploy.
3. **Option B (Database Forward-Migration):** Apply a new migration that restores compatibility (e.g., adds back the dropped column or removes the strict `NOT NULL` constraint), then roll back the code.
4. **Option C (Neon PITR Branch Cutover):** If severe data corruption occurred, follow the database disaster recovery protocol (see `docs/DATABASE-DISASTER-RECOVERY.md`), noting that this requires dual sign-off and reconciliation of delta data.

---

## 6. Comprehensive Recovery Decision Matrix

| Incident Scenario | Symptoms | Immediate Action | Secondary Action | Do NOT Do |
| :--- | :--- | :--- | :--- | :--- |
| **Application Crash (SSR / API 500s)** | High error rate in Sentry; `/api/health` returns 500; syntax/bundle error. | Check if DB migrations were run. If no, **execute Vercel rollback**. | Inspect Pino logs using correlation `request_id` to diagnose root cause. | Do not restart or reset the database. |
| **Database Migration Failure** | `drizzle-kit migrate` failed midway or produced constraint errors. | Stop deployment immediately. Inspect Neon schema status. | Roll forward with a reviewed corrective migration script. | Do not run unverified manual `DROP` or `ALTER` SQL scripts directly on production. |
| **Database Outage (Neon Unreachable)** | `/api/health/ready` returns 503; errors contain `connection refused` or `timeout`. | Check Neon status page. Do NOT roll back application code. | Enable maintenance notice if downtime exceeds 5 minutes. | Do not redeploy or roll back Vercel. Code is not the cause. |
| **Razorpay Webhook Failure** | `/api/webhook/razorpay` returning 500 or 400 signature verification failures. | Verify `RAZORPAY_WEBHOOK_SECRET` in Vercel environment variables. | Verify provider retry settings; check logs for secret mismatch. | Do not manually mark orders as `paid` in the database without direct provider verification and dual approval. |
| **Storage Outage (Cloudflare R2)** | Product images fail to render; upload endpoints fail. | Check Cloudflare status. Serve fallback placeholder images. | Queue any background upload jobs. | Do not roll back application deployment. |
| **Email Failure (Resend API Outage)** | Order confirmation emails not received; logs show Resend 429/5xx. | Resend calls are wrapped in non-fatal `try/catch`. Orders succeed regardless. | Review Resend status and queue failed notifications for replay. | Do not abort checkout or refund orders due to email notification failures. |
| **Schema Desynchronization** | Code errors: `column "x" does not exist` or `null value in column "y" violates not-null`. | If rolled back code is incompatible with current DB, roll forward code to compatible version. | Apply backward-compatible schema adjustment via Drizzle. | Do not attempt blind rollback across multiple major versions. |

---

## 7. Payment & Order Consistency Rules During Rollback

Financial integrity is paramount. During any incident or rollback, enforce the following rules:

### Source of Truth
- **Razorpay is the sole authority on payment capture status.**
- The local database (`orders`, `payments`, `order_counters`) records the application business state, but captured funds in Razorpay govern whether an order is legally fulfilled or refunded.

### In-Flight Checkout & Webhook Guarantees
1. **Idempotency Keys:**
   - Every order creation uses `idempotency_key` (UUID v4) stored in the `orders` table.
   - Rolling back code does not duplicate orders because idempotent checkouts reject duplicate key submissions.
2. **Webhook Deduplication:**
   - Razorpay webhook events are recorded in `webhook_events` with their unique `eventId`.
   - If an event is received again during or after a rollback, the database unique constraint prevents duplicate execution.
3. **Webhook Retries:**
   - Razorpay's platform supports automatic webhook redelivery for up to 24 hours with exponential backoff on non-2xx responses. (Active retry configuration, webhook secret, and enabled events must be verified directly in the Razorpay Dashboard).
   - As soon as the rollback restores a working deployment, pending webhooks can be received, verified, and processed.

### Manual Payment & Order Reconciliation Procedure After Incident
If an incident occurred during checkout or payment processing, execute the following **manual reconciliation protocol**.

> [!CAUTION]
> **Mandatory Dual Approval Required:**
> Obtain dual sign-off from the **Incident Commander** and **Financial Lead** before making any manual financial or order-status corrections.
> **Never create synthetic customer orders** from incomplete payment metadata.

Before performing any correction:
1. **Identify Identifiers:** Identify the Razorpay payment ID (`pay_xxx`) and Razorpay order ID (`order_xxx`).
2. **Search Local Orders:** Query the local `orders` table using the Razorpay order ID and search for existing order associations:
   ```sql
   SELECT o.id, o.order_number, o.status, o.total_paise, p.id AS payment_id, p.status AS payment_status, p.razorpay_payment_id
   FROM orders o
   LEFT JOIN payments p ON p.order_id = o.id
   WHERE p.razorpay_order_id = '<RAZORPAY_ORDER_ID>' OR p.razorpay_payment_id = '<RAZORPAY_PAYMENT_ID>';
   ```
3. **Check Relevant Records & Associations:** Check whether an order already exists before considering any update or insertion.
4. **Provider-Side Verification:** Verify payment status, currency, and exact captured amount directly against the Razorpay Dashboard or Razorpay API.
5. **Check for Duplicate Processing:** Verify that duplicate payment processing, partial refunds, or multiple webhook deliveries have not already been recorded in `webhook_events`.
6. **Reconcile Inventory Independently:** Stock and inventory must be reconciled separately in `product_variants`. Do not adjust order state without confirming inventory availability and reservation state.
7. **Handle Discrepancies:**
   - **Case A: Payment Captured in Razorpay, Existing Order is `pending` or `cancelled` in DB:**
     - Verify payment amount matches `total_paise` exactly.
     - With dual sign-off, update order status to `paid` and record payment row.
     - Reconcile stock reservation separately.
   - **Case B: Order marked `paid` in DB, but Payment is `failed` or absent in Razorpay:**
     - Flag for fraud/attention: set `attention_reason = 'payment_unconfirmed'`, `attention_at = NOW()`.
     - Contact customer before shipping goods.
   - **Case C: Amount Mismatch:**
     - Flag status to `refund_required` as enforced by `src/lib/orders/capture-payment.ts`.
   - **Case D: Captured Payment with No Corresponding Local Order (Incomplete Metadata):**
     - Do **not** synthesize an order. Escalate to customer support for verified manual customer outreach or process an authorized refund via Razorpay.

---

## 8. External Service Handling During Rollback

| External Service | Role | Behavior During Rollback | Action Required |
| :--- | :--- | :--- | :--- |
| **Razorpay** | Payment Gateway | Unaffected by Vercel rollback. Retries failed webhooks per merchant configuration. | Verify webhook endpoint responds with HTTP 200 after rollback. |
| **Shiprocket** | Logistics & Tracking | Orders already submitted to Shiprocket retain their AWB/shipment IDs. | Do not re-trigger shipment creation for existing orders. |
| **Resend** | Transactional Emails | Safe. Failures are logged at `WARN` level and do not throw. | Check Sentry/Pino logs for unhandled email errors. |
| **Cloudflare R2** | Image Storage | Immutable object storage. Keys remain unchanged. | Ensure rolled-back code does not use retired storage bucket paths. |

---

## 9. Post-Recovery Verification Checklist

Once a rollback is executed, complete every item in this checklist before declaring the incident resolved:

- [ ] **Liveness Probe:** `curl -s -f https://spnhealthmix.com/api/health` returns `{"status":"ok"}` with HTTP 200.
- [ ] **Readiness Probe:** `curl -s -f https://spnhealthmix.com/api/health/ready` returns `{"status":"ready","checks":{"database":"ok"}}` with HTTP 200.
- [ ] **Homepage & Catalog:** Load homepage, product details, and cart in a fresh browser session (incognito mode).
- [ ] **Checkout Initialization (Smoke Test):** Test `/api/checkout/initiate` with test payload or staging credentials to confirm Razorpay order creation succeeds.
- [ ] **Sentry Error Stream:** Monitor Sentry for 15 minutes. Verify that new event rate drops to normal baseline and no new unhandled exceptions appear.
- [ ] **Vercel Log Stream:** Monitor Pino structured logs. Verify incoming requests generate `level: 30` (info) and `request_id` entries without error bursts.
- [ ] **Database Connection Health:** Confirm active database connection count is within Neon pool bounds.
- [ ] **Incident Communication:** Post incident status update to internal engineering channel and customer support team.

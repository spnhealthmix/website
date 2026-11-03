# SPN Health Mix – Incident Response Checklist & Runbook

This operational checklist is designed for on-call engineers responding to production alerts, customer-reported degradations, and deployment failures in the SPN Health Mix application.

---

## ⚡ Fast Reference: Critical Endpoints & Links

- **Liveness Health Check:** `https://spnhealthmix.com/api/health`
- **Readiness Health Check:** `https://spnhealthmix.com/api/health/ready`
- **Sentry Dashboard:** [Sentry Issues](https://sentry.io)
- **Vercel Dashboard:** [Vercel Deployments](https://vercel.com)
- **Neon Console:** [Neon Database Branches](https://console.neon.tech)
- **Razorpay Dashboard:** [Razorpay Payments](https://dashboard.razorpay.com)

---

## Phase 1: Detection & Triage (Target: < 5 Minutes)

### 1.1 Verify Alert Authenticity
- [ ] **Check Liveness:**
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://spnhealthmix.com/api/health
  # Expected: 200
  ```
- [ ] **Check Readiness (Database Connectivity):**
  ```bash
  curl -s https://spnhealthmix.com/api/health/ready
  # Expected: {"status":"ready","checks":{"database":"ok"}}
  ```
- [ ] **Check Sentry Alert:** Open Sentry to identify the volume and error signature of incoming exceptions.
- [ ] **Check Vercel Deployment State:** Confirm if a deployment was promoted within the last 30 minutes.

### 1.2 Assign Incident Roles
- [ ] **Incident Commander (IC):** Leads decision-making, delegates tasks, owns external communications.
- [ ] **Technical Lead / Investigator:** Deep-dives into logs, traces, database state, and code diffs.
- [ ] **Communications Lead:** Updates status page, notifies customer support, drafts customer communications.

### 1.3 Classify Severity
- [ ] **SEV-1 (Critical):** Checkout/payments completely down, homepage/catalog 500s, or database unavailable.
- [ ] **SEV-2 (Major):** Specific user journey broken (order history, search), webhook failures, or significant latency.
- [ ] **SEV-3 (Minor):** Background email delay, minor UI defect, or non-blocking admin tool failure.

---

## Phase 2: Containment & Traffic Management (Target: < 15 Minutes)

### 2.1 Assess Deployment Correlation
- [ ] Did the incident begin immediately following a Vercel deployment?
  - **YES:** Check if the deployment included database migrations (`drizzle/` directory).
    - **No migrations:** Proceed directly to **Action A: Vercel Rollback** (Phase 4).
    - **Migrations present:** Assess schema compatibility (see `docs/DEPLOYMENT-ROLLBACK.md` Section 5) before rolling back.
  - **NO:** Proceed to external provider verification (Neon, Razorpay, Shiprocket).

### 2.2 Protect In-Flight Customer Data
- [ ] If payments are failing or data corruption is occurring, halt new order creation by enabling maintenance mode or temporarily disabling checkout initialization API routes.
- [ ] If payment webhook is failing with 500, confirm Razorpay webhook endpoint is reachable. Razorpay retries per merchant configuration. **Do not mark orders as paid manually without verification and dual approval.**

---

## Phase 3: Evidence Collection (Concurrent with Containment)

### 3.1 Structured Logging & Correlation IDs
- [ ] Locate failing requests in Vercel Runtime Logs.
- [ ] Extract the `request_id` from the log output:
  ```json
  {"level":50,"time":"2026-11-03T...","request_id":"req_01H...","err":{"message":"..."}}
  ```
- [ ] Search Vercel logs by `request_id` to trace the full lifecycle of the failing operation.

### 3.2 Sentry Exception Capture
- [ ] Filter Sentry issues by `environment:production` and `release:<current_release>`.
- [ ] Capture the Sentry Event ID, stack trace, and associated breadcrumbs.
- [ ] Confirm whether errors originate from client-side React hydration, serverless Node.js runtime, or Edge middleware.

### 3.3 Database & External Metrics
- [ ] **Neon Console:** Check active compute CPU, active connections, and replication lag.
- [ ] **Razorpay Dashboard:** Check for webhook delivery failures or elevated failure rates.
- [ ] **Resend / Shiprocket:** Check status pages for third-party upstream outages.

### 3.4 Mandatory Evidence Recording Checklist
Record the following details in the incident log (**Never include credentials or secret values**):
- [ ] Incident start timestamp and detection timestamp (UTC).
- [ ] Recovery point ($T_{recover}$) selected, with documented justification from logs.
- [ ] Affected Vercel deployment ID and commit hash.
- [ ] Affected database branch name and compute endpoint.
- [ ] Relevant `request_id` values from Pino logs and Sentry Event IDs.
- [ ] Razorpay payment IDs (`pay_xxx`) and order IDs (`order_xxx`), where applicable.
- [ ] Approval records (sign-off names, roles, and timestamps).
- [ ] Full sequence of recovery actions performed.

---

## Phase 4: Recovery Execution

Choose the appropriate action based on the Incident Decision Matrix:

```
┌──────────────────────────────────────────────────────────────┐
│                   Incident Root Cause                        │
└──────────────────────────────┬───────────────────────────────┘
                               │
       ┌───────────────────────┼───────────────────────┐
       ▼                       ▼                       ▼
[Code Regression]      [Database Failure]     [External Outage]
       │                       │                       │
       ▼                       ▼                       ▼
  [Action A]              [Action B]              [Action C]
(Vercel Rollback)       (Neon PITR Branch)      (Fallback / Wait)
```

### Action A: Application Code Rollback (Vercel)
*Condition: Code bug without breaking DB migrations.*
1. [ ] Open Vercel Dashboard > **Deployments**.
2. [ ] Locate the last-known-good production deployment.
3. [ ] Click **`...`** > **Instant Rollback** (or **Promote to Production**).
4. [ ] Confirm rollback. (Vercel re-aliases edge domains; target estimate is under 1 minute; actual duration depends on edge propagation).
5. [ ] Verify rollback success via `GET /api/health`.

### Action B: Database Disaster Recovery (Neon PITR)
*Condition: Data corruption, accidental deletion, or catastrophic failure.*

> [!CAUTION]
> **MANDATORY CHECKPOINT:**
> Obtain dual sign-off from the **Incident Commander** and **Tech Lead/DBA** before production database restore, branch cutover, or destructive data recovery.

1. [ ] Identify verified timestamp $T_{recover}$ based on query logs and evidence (the 60-second heuristic is a starting point, not an invariant rule).
2. [ ] Create Neon recovery branch:
   ```bash
   neon branches create --name recovery-$(date +%Y%m%d-%H%M) --timestamp "<VERIFIED_T_RECOVER>"
   ```
3. [ ] Inspect data on the recovery branch to ensure validity.
4. [ ] **Targeted Recovery (Preferred):** Dump missing records from recovery branch and insert into production.
   *OR*
5. [ ] **Full Cutover (Requires Dual Sign-off):** Update `DATABASE_URL` in Vercel to point to recovery branch pooler URL and trigger redeployment.
6. [ ] Execute manual order reconciliation protocol (see `docs/DATABASE-DISASTER-RECOVERY.md` Section 5).

### Action C: Third-Party Service Fallback
*Condition: Upstream provider outage (Neon, Razorpay, Resend, Cloudflare).*
1. [ ] Check official status pages:
   - Neon: `https://status.neon.tech`
   - Razorpay: `https://status.razorpay.com`
   - Resend: `https://status.resend.com`
2. [ ] If Razorpay checkout is degraded: Display user-facing notification banner on checkout screen.
3. [ ] If Resend is down: Verify that non-fatal try/catch in email service allows order completion without throwing.

---

## Phase 5: Post-Recovery Verification (Target: < 10 Minutes Post-Recovery)

Execute every verification step before resolving the incident:

- [ ] **1. Probe Liveness:**
  ```bash
  curl -i https://spnhealthmix.com/api/health
  # Must return HTTP 200 {"status":"ok"}
  ```
- [ ] **2. Probe Readiness:**
  ```bash
  curl -i https://spnhealthmix.com/api/health/ready
  # Must return HTTP 200 {"status":"ready","checks":{"database":"ok"}}
  ```
- [ ] **3. Verify Edge Routing:** Inspect response headers (`x-vercel-id`) to confirm target deployment is serving traffic.
- [ ] **4. End-to-End Smoke Test:**
  - Load Homepage and Catalog.
  - Add product to cart.
  - Initiate checkout (`/api/checkout/initiate`) to verify Razorpay order creation.
- [ ] **5. Sentry Health Check:** Verify that new error frequency has returned to baseline levels for 15 consecutive minutes.
- [ ] **6. Pino Logs Verification:** Verify serverless function execution logs show normal 2xx responses and no `level: 50` spikes.

---

## Phase 6: Post-Incident Closure & Reconciliation

### 6.1 Order & Financial Reconciliation Checkpoint
> [!CAUTION]
> **MANDATORY CHECKPOINT:**
> Obtain dual sign-off from the **Incident Commander** and **Financial Lead** before making manual financial or order-status corrections.
> **Never create synthetic customer orders** from incomplete payment metadata.

- [ ] Export all orders and transactions created during the incident window.
- [ ] Cross-reference with captured transactions directly in Razorpay Dashboard.
- [ ] Search local `orders` and `payments` by `razorpay_order_id` and `razorpay_payment_id` before modifying any records.
- [ ] Reconcile inventory and stock counts independently in `product_variants`.
- [ ] Escalate incomplete transactions for manual customer support outreach or authorized provider refund.

### 6.2 Customer Communication & De-escalation
- [ ] Notify customers whose orders were delayed or interrupted.
- [ ] Brief customer support team on resolved status and FAQ script.
- [ ] Update internal status channel: Incident declared **RESOLVED**.
- [ ] Document all recovery actions taken, timestamps, and participating engineers.

### 6.3 Blameless Post-Mortem Schedule
- [ ] Schedule post-mortem meeting within 48 hours.
- [ ] Generate post-mortem document covering:
  - Root cause analysis (5 Whys).
  - Timeline of detection, triage, containment, and recovery.
  - Preventative action items (e.g. additional automated tests, health probe monitors).

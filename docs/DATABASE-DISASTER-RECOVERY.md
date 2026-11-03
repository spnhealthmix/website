# SPN Health Mix – Database Disaster Recovery Plan

This runbook defines the technical procedures, operational safeguards, and data reconciliation strategies for recovering from database failure, corruption, or migration incidents in the SPN Health Mix application using **Neon PostgreSQL** and **Drizzle ORM**.

---

## 1. Distinction of Recovery Operations

Before initiating any incident remediation, operators must distinguish three fundamentally different recovery operations:

| Recovery Operation | Scope & Mechanism | Data Loss Risk | Recommended Application |
| :--- | :--- | :--- | :--- |
| **Schema Recovery** | Correcting incompatible or failed DDL changes through reviewed Drizzle migrations (`drizzle-kit migrate`). | **Zero data loss** | Migration failure, syntax error, missing index/column. |
| **Data Recovery** | Restoring database state or records from a verified Neon PITR branch or snapshot. | **High risk:** Discards all delta transactions created after recovery point. | Severe data corruption, accidental truncation, malicious deletion. |
| **Application Rollback** | Restoring a previous Vercel deployment artifact without rebuilding. | **Zero database changes** | Frontend/SSR crash, serverless runtime exceptions (provided DB schema is compatible). |

> [!WARNING]
> **Do not treat these operations as interchangeable.**
> Performing a Data Recovery (PITR restore) to fix a code bug or schema issue causes unnecessary loss of customer orders. Conversely, an Application Rollback will not fix corrupted data or broken database schema.

---

## 2. Neon PostgreSQL Architecture & Backup Baseline

The SPN Health Mix database infrastructure is hosted on **Neon**, a serverless PostgreSQL platform featuring decoupled compute and storage:

```
+-------------------------------------------------------------+
|                     Next.js / Vercel API                     |
|                                                              |
|        DATABASE_URL (Connection Pooler / Direct)            |
+------------------------------+-------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|                 Neon Compute (Stateless Postgres)            |
+------------------------------+-------------------------------+
                               |
                               v
+-------------------------------------------------------------+
|             Neon Storage Engine (Pageservers)                |
|  - Continuous WAL streaming to Safekeepers                  |
|  - Point-in-Time Recovery (PITR) via log playback           |
|  - Instant Zero-Copy Branching (Copy-on-Write)               |
+-------------------------------------------------------------+
```

### Provider Capabilities vs. Enabled Project Configuration
- **Continuous Archiving:** Neon automatically streams and persists Write-Ahead Logs (WAL) to distributed Safekeepers.
- **Point-in-Time Recovery (PITR):** Neon supports branching or restoring the database to historical timestamps within its retention window.
  - *Neon Provider Capabilities:* Free tier offers 24-hour retention; Launch / Scale / Enterprise tiers offer configurable retention from 7 days up to 30 days.
  - *Recommended SPN Health Mix operational baseline:* Production should use a Neon configuration supporting at least seven days of PITR history. The active project plan and configured retention must be verified in the Neon Console.
- **Instant Branching:** Neon branches are lightweight, copy-on-write clones created in seconds. Quotas and concurrent branch limits depend on the active Neon subscription plan.

---

## 3. Disaster Scenarios & Recovery Strategies

| Disaster Scenario | Root Cause | Impact | Recommended Recovery Path |
| :--- | :--- | :--- | :--- |
| **Scenario A: Data Corruption or Accidental Truncation** | Rogue query, flawed administrative script, or accidental `DELETE` / `DROP TABLE`. | Critical data missing (e.g., deleted orders, customers, or products). | **Data Recovery (Neon PITR):** Spawn a verified recovery branch at timestamp $T_{recover}$; cherry-pick missing data or execute approved cutover. |
| **Scenario B: Broken Drizzle Migration** | Migration script failed midway or altered schema incompatibly. | 500 errors on database operations; Drizzle schema mismatch; app downtime. | **Schema Recovery (Roll-Forward):** Apply a reviewed corrective migration (`0007_fix_xxx.sql`). Do not perform a PITR restore unless data was corrupted. |
| **Scenario C: Neon Service or Regional Outage** | Cloud provider zone failure or Neon control plane outage. | Readiness probe `/api/health/ready` returns 503; database connection timeouts. | **Infrastructure Monitoring:** Monitor status page (`status.neon.tech`). If extended outage occurs, failover to standby replica if configured. |

---

## 4. Neon Branch-Based PITR Recovery Procedure

When data corruption occurs, follow this exact procedure:

```
[Incident Detected]
       │
       ▼
[1. Freeze Traffic / Containment]
       │
       ▼
[2. Identify Recovery Timestamp (T_recover)]
       │
       ▼
[3. Create Neon Recovery Branch at T_recover]
       │
       ▼
[4. Inspect & Validate Recovery Branch Data]
       │
       ├─────────────────────────────────┐
       ▼                                 ▼
[Path A: Cherry-Pick Missing Data]   [Path B: Full Branch Cutover]
(Export rows & re-insert)             (REQUIRES DUAL APPROVAL)
       │                                 │
       └────────────────┬────────────────┘
                        ▼
           [5. Verify via /api/health/ready]
                        │
                        ▼
           [6. Manual Order Reconciliation]
```

### Step 1: Containment
1. If corruption is ongoing (e.g., a rogue background worker or compromised API key), immediately freeze write traffic by setting the application to maintenance mode or revoking write credentials.
2. Alert the engineering team and declare a SEV-1 incident.

### Step 2: Determine Recovery Timestamp ($T_{recover}$)
- Select a recovery timestamp based on the earliest verified point before data corruption.
- The 60-second offset is only a heuristic starting point and must be validated against incident timelines, logs and available database evidence.
- Note that corruption may have started well before the first monitoring alert or customer report. Inspect query logs, audit records, and Sentry breadcrumbs to establish the true pre-corruption boundary.

### Step 3: Create Neon Recovery Branch
Execute via Neon Console or Neon CLI:

```bash
# Using Neon CLI:
neon branches create \
  --project-id <NEON_PROJECT_ID> \
  --name recovery-$(date +%Y%m%d-%H%M) \
  --timestamp "<VERIFIED_T_RECOVER>"
```

*Via Neon Console:*
1. Open Neon Project Dashboard > **Branches**.
2. Click **Create Branch**.
3. Name: `recovery-YYYYMMDD-HHMM`.
4. Parent: `main`.
5. Check **Branch from a past point in time**.
6. Enter the exact verified UTC timestamp ($T_{recover}$).
7. Click **Create Branch**.

### Step 4: Validate Recovery Branch Data
1. Obtain the connection string for the recovery branch from the Neon dashboard.
2. Connect securely using `psql`:
   ```bash
   psql "postgres://[user]:[password]@ep-recovery-xxx.neon.tech/neondb?sslmode=require"
   ```
3. Run verification queries to confirm data integrity before considering any restore action:
   ```sql
   -- Verify table counts and integrity
   SELECT COUNT(*), MAX(created_at) FROM orders;
   SELECT COUNT(*) FROM order_items;
   SELECT COUNT(*) FROM payments;
   SELECT * FROM __drizzle_migrations ORDER BY id DESC LIMIT 5;
   ```

### Step 5: Choose Recovery Path

#### Path A: Targeted Data Cherry-Pick (Recommended for partial data loss)
If only specific rows or tables were lost:
1. Export only the missing records from the recovery branch:
   ```bash
   pg_dump "postgres://[user]:[password]@ep-recovery-xxx.neon.tech/neondb?sslmode=require" \
     --table=orders --data-only --inserts > recovered_rows.sql
   ```
2. Review the SQL script manually to ensure only missing rows are included.
3. Apply the recovered rows to production `main`.
4. Delete the temporary recovery branch after validation.

#### Path B: Full Branch Cutover (Catastrophic Corruption Only)

> [!CAUTION]
> **MANDATORY DUAL-APPROVAL CHECKPOINT:**
> Production database branch cutover or `DATABASE_URL` replacement strictly requires written authorization from both the **Incident Commander** and the **Tech Lead / DBA**.
> Executing a branch cutover discards all database activity between $T_{recover}$ and current time $T_{now}$.

1. Obtain dual written sign-off in the incident log.
2. Promote the recovery branch in Neon Console or copy its pooled connection string.
3. Update `DATABASE_URL` in Vercel Project Settings:
   - Go to Vercel Dashboard > **Settings** > **Environment Variables**.
   - Edit `DATABASE_URL` for `Production` and `Preview`.
   - Set to the verified pooled connection:
     `postgresql://[user]:[password]@ep-recovery-xxx-pooler.neon.tech/neondb?sslmode=require`
4. Redeploy in Vercel to invalidate warm serverless worker connections:
   ```bash
   vercel redeploy <LATEST_DEPLOYMENT_ID>
   ```
5. Execute the Manual Payment & Order Reconciliation Protocol in Section 5.

---

## 5. Manual Payment & Order Reconciliation Protocol

When performing a **Full Branch Cutover** to timestamp $T_{recover}$, any transactions or records created between $T_{recover}$ and current time $T_{now}$ (the "Delta Window") will **not** exist in the recovered database.

```
       T_recover                      T_now
          │◄──────── Delta Window ────────►│
          ▼                                ▼
[Database Restored at T_recover]  [Live Transactions During Outage]
(Delta data absent)               (Recorded in Razorpay Dashboard)
```

> [!IMPORTANT]
> **Strict Operational Rule:**
> **Do not automatically insert orders, mark payments as paid, deduct stock or initiate refunds.**
> Never create synthetic customer orders from incomplete payment metadata. Follow this audited manual protocol:

### Step-by-Step Manual Reconciliation Protocol:
1. **Identify the Affected Recovery Window:** Determine the exact time interval between $T_{recover}$ and when write traffic was frozen or restored.
2. **Obtain Captured Payments Directly from Provider:** Export all transactions from the Razorpay Dashboard (or fetch via Razorpay API) where `status = 'captured'` and `created_at` falls within the Delta Window.
3. **Cross-Reference Against Local Records:** Match each `razorpay_payment_id` and `razorpay_order_id` against the recovered database `payments` and `orders` tables.
4. **Check Existing Order Associations:** Check whether an order already exists for that transaction before considering any correction:
   ```sql
   SELECT o.id, o.order_number, o.status, p.id AS payment_id, p.status AS payment_status
   FROM orders o
   JOIN payments p ON p.order_id = o.id
   WHERE p.razorpay_order_id = '<RAZORPAY_ORDER_ID>' OR p.razorpay_payment_id = '<RAZORPAY_PAYMENT_ID>';
   ```
5. **Verify Provider-Side Status & Amounts:** Verify amounts, currency, fee deductions, and payment status directly in the Razorpay Dashboard.
6. **Reconcile Product Variants and Inventory Separately:** Stock reservations in `product_variants.stock_quantity` must be audited independently. Never adjust inventory without verifying physical stock availability.
7. **Identify Incomplete Records:** Identify cases where shipping address, customer email/phone, purchased line items, or variant options are missing or incomplete.
8. **Escalate Incomplete Records:** Escalate incomplete transactions for verified manual customer outreach or process an authorized provider refund via Razorpay rather than creating incomplete database records.
9. **Obtain Approval for Every Correction:** Require explicit approval from the **Incident Commander** and **Financial Lead** before committing any financial or order record correction to the database.
10. **Document Audit Evidence:** Log every correction, matching Razorpay transaction ID, approval timestamp, and operator identifier in the incident post-mortem record.

---

## 6. Drizzle Migration Failure Recovery Strategy

### Drizzle Kit Mechanics
- Drizzle tracks applied migrations in the `__drizzle_migrations` table:
  ```sql
  SELECT id, hash, created_at FROM __drizzle_migrations ORDER BY id DESC;
  ```
- **Important:** Drizzle Kit does not provide automated down migrations (`drizzle-kit down` does not exist).
- PostgreSQL DDL inside a transaction block (`BEGIN ... COMMIT`) is transactional, but non-transactional statements (`CREATE INDEX CONCURRENTLY`, certain `ALTER TYPE`) can leave partial schema artifacts.

### Migration History Policy
> [!CAUTION]
> **Never manually delete or modify Drizzle migration history as a routine recovery technique.**
> Inspect the actual migration state and database schema, then use a reviewed corrective migration or forward-fix strategy. Any exceptional recovery procedure requires explicit technical approval from the Tech Lead / DBA.

### Recovery Workflow for Failed Migrations:
1. **Never edit or delete already applied migration files in `drizzle/`:**
   Editing past migrations invalidates SHA-256 hashes recorded in `__drizzle_migrations`, breaking future migration runs.
2. **Inspect Migration Error Logs:** Determine the exact SQL statement and error code from the deployment log or Sentry.
3. **Formulate a Forward-Fix Migration:**
   - Create a new migration file: `drizzle/0007_corrective_patch.sql`.
   - Include only the missing statements or schema corrections.
   - Run `npx drizzle-kit migrate` in the reviewed CI/CD pipeline.
4. **If Schema State is Partially Corrupted:**
   - Connect to Neon using `psql`.
   - Inspect existing tables and constraints against `src/lib/db/schema.ts`.
   - Draft a reviewed corrective SQL patch to bring the database schema into alignment with Drizzle schema declarations.

---

## 7. Safe Database Connection Switching Procedure

When repointing Vercel to a new or recovered Neon database:

### 1. Connection String Anatomy
Neon provides two connection string types:
- **Pooled Connection (`-pooler`):**
  `postgresql://[user]:[password]@ep-xxx-pooler.neon.tech/neondb?sslmode=require`
  *Use for:* Next.js App Router API routes, Server Actions, and runtime queries to prevent connection exhaustion.
- **Direct Connection:**
  `postgresql://[user]:[password]@ep-xxx.neon.tech/neondb?sslmode=require`
  *Use for:* Running Drizzle migrations (`npm run db:migrate`) where session pooling or transaction-level DDL locks are required.

### 2. Dual-Approval Checkpoint & Variable Update
> [!CAUTION]
> **Dual Approval Required:** Obtain explicit authorization from the Incident Commander and Tech Lead before updating `DATABASE_URL`.

1. Open Vercel Project Dashboard > **Settings** > **Environment Variables**.
2. Locate `DATABASE_URL`.
3. Click **Edit**.
4. Update value with the verified pooled connection string.
5. Save for **Production** and **Preview**.
6. Trigger a redeployment to ensure new worker instances inherit the updated configuration:
   ```bash
   vercel redeploy <LATEST_DEPLOYMENT_ID>
   ```

### 3. Verify Connectivity
Test the readiness endpoint immediately:
```bash
curl -i https://spnhealthmix.com/api/health/ready
```
Expected response:
```http
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ready","checks":{"database":"ok"}}
```

---

## 8. Mandatory Manual Approval Requirements

To prevent compounding damage during incidents, the following recovery actions strictly require two-person authorization:

| Operation | Risk Level | Required Approvals | Audit Requirement |
| :--- | :--- | :--- | :--- |
| **Point-in-Time Branch Cutover** | **CRITICAL** (Discards delta data) | Incident Commander + Tech Lead/DBA | Written confirmation in incident channel with verified timestamp and justification. |
| **Production Database URL Switch** | **HIGH** (Traffic redirection) | Incident Commander + Tech Lead/DBA | Pre-switch validation and post-switch health check verification log. |
| **Manual Financial / Order Corrections** | **HIGH** (Financial & inventory state) | Incident Commander + Financial Lead | Cross-referenced Razorpay payment ID and inventory audit evidence attached to ticket. |
| **Manual Table Truncation / Row Deletion** | **CRITICAL** (Irreversible data loss) | Tech Lead + Lead DBA | Pre-execution `pg_dump` of target table attached to ticket. |

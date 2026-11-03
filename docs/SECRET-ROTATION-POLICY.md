# SPN Health Mix – Production Secret Rotation Policy

This policy governs the lifecycle, review frequency, approval hierarchy, and emergency response procedures for operational credentials, database secrets, and third-party API keys in the SPN Health Mix e-commerce platform.

---

## 1. Scope & Categorization

Credentials in the SPN Health Mix platform are categorized by exposure risk, operational impact, and rotation complexity:

| Credential Category | Description | Examples | Recommended Review Cadence |
| :--- | :--- | :--- | :--- |
| **Category A: Critical Infrastructure Secrets** | Direct access to primary database, serverless compute, or object storage. | `DATABASE_URL`, `R2_SECRET_ACCESS_KEY` | **90-Day Review / Scheduled Rotation** |
| **Category B: Financial & Payment Gateway Secrets** | Credentials authorizing charges, signature verification, or payment webhooks. | `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | **90-Day Review / Coordinated Replacement** |
| **Category C: Operational Communication & Build Secrets** | Credentials used for transactional emails or CI/CD build artifacts. | `SMTP_PASSWORD`, `SENTRY_AUTH_TOKEN` | **180-Day Review / On Personnel Change** |
| **Category D: Public Identifiers (Non-Secrets)** | Public client identifiers, CDN endpoints, and ingestion DSNs that do not grant administrative access. | `RAZORPAY_KEY_ID`, `SENTRY_DSN`, `R2_PUBLIC_BASE_URL` | **Rotated only if deprecated or re-provisioned** |

> [!NOTE]
> The **90-day credential review cycle** is an internal operational policy recommendation designed to ensure rotation readiness, verify access lists, and limit compromise windows. It is not an invariant technical requirement imposed by external providers.

---

## 2. Credential Ownership & Governance Matrix

Every active operational secret has a designated primary owner, backup custodian, and explicit approval requirements:

| Credential | Primary Owner | Backup Custodian | Approval Required for Rotation |
| :--- | :--- | :--- | :--- |
| `DATABASE_URL` | Lead Database Administrator (DBA) | Technical Lead | **Incident Commander + Tech Lead/DBA** |
| `RAZORPAY_KEY_SECRET` | Financial Lead / CFO | Lead Backend Engineer | **Incident Commander + Financial Lead** |
| `RAZORPAY_WEBHOOK_SECRET` | Lead Backend Engineer | Technical Lead | **Technical Lead** |
| `SMTP_PASSWORD` | Technical Lead | Full-Stack Engineer | **Technical Lead** |
| `R2_SECRET_ACCESS_KEY` | Cloud Infrastructure Lead | Full-Stack Engineer | **Technical Lead** |
| `SENTRY_AUTH_TOKEN` | Observability / DevOps Lead | Technical Lead | **DevOps Lead** |

---

## 3. Routine Rotation Policy

### 3.1 Pre-Conditions for Routine Rotation
A routine credential rotation must only occur when:
1. No active SEV-1, SEV-2, or SEV-3 operational incidents are ongoing.
2. The deployment pipeline is healthy (all automated tests passing, `GET /api/health/ready` returning 200).
3. The rotation is scheduled during low-traffic operational windows (e.g., 01:00–04:00 IST).
4. The procedure has been reviewed using the provider-specific runbook in `docs/SECRET-ROTATION-RUNBOOK.md`.
5. A safe rollback and contingency path is prepared.

### 3.2 Dual-Key & Overlapping Credentials
- Do **not** assume external providers automatically support overlapping dual-key rotation. Each provider's capabilities must be verified against current account settings.
- If a provider supports multiple active credentials (e.g., Cloudflare R2 multi-token support, Neon secondary roles), provision and verify the new credential before revoking the previous credential.
- If a provider requires replacing a single shared secret (e.g., standard API keys), schedule a coordinated deployment where the new credential is deployed to Vercel and immediately verified.

---

## 4. Emergency Rotation Policy (Suspected or Confirmed Compromise)

### 4.1 Trigger Conditions
Immediate emergency rotation is mandatory upon:
1. Accidental commit of credentials to any Git branch, issue tracker, pull request, or public paste site.
2. Discovery of plaintext credentials in application logs, error monitoring tools (Sentry), or browser network tabs.
3. Security incident or credential compromise report from a third-party vendor (Neon, Razorpay, Cloudflare).
4. Involuntary termination, offboarding, or device theft of an engineer or administrator with access to production secrets.

### 4.2 Emergency Execution Protocol
In an emergency rotation:
1. **Declare SEV-1 Security Incident:** Immediately convene the Incident Commander and relevant credential owner.
2. **Containment First:** If a leak is ongoing, revoke permissions or isolate the endpoint immediately.
3. **Emergency Dual Sign-Off:** Written authorization from the Incident Commander and Technical Lead is required.
4. **Deploy & Flush:** Deploy new credentials to Vercel production environment variables and trigger an immediate redeployment (`vercel redeploy`) to flush warm serverless instances.
5. **Immediate Revocation:** Once the new deployment is confirmed operational via `/api/health/ready`, revoke the compromised credential at the provider.
6. **Audit Logs:** Request provider-side access logs (Razorpay API logs, Neon query logs, Cloudflare R2 audit logs) for the 72 hours preceding revocation to assess unauthorized access.

---

## 5. Personnel Offboarding Rotation Policy

When an employee, contractor, or vendor with access to production environment variables or provider dashboards departs:
1. Within **24 hours** of offboarding:
   - Revoke Vercel team access.
   - Revoke Neon console / database user access.
   - Revoke Razorpay and Cloudflare dashboard seats.
   - Rotate shared service passwords (`SMTP_PASSWORD`).
2. Within **7 days** of offboarding:
   - Review and rotate `R2_SECRET_ACCESS_KEY` and `SENTRY_AUTH_TOKEN`.
   - Update and audit administrative accounts via `scripts/create-admin.ts`.

---

## 6. Legacy Integration Policy (Shiprocket)

- **Business Determination:** Shiprocket and its features are **not required** for current SPN Health Mix business operations.
- **Rotation Exclusion:** Shiprocket credentials (`SHIPROCKET_EMAIL`, `SHIPROCKET_PASSWORD`, `SHIPROCKET_WEBHOOK_SECRET`) are excluded from active rotation schedules, governance matrices, and routine reviews.
- **Cleanup Strategy:** Unused Shiprocket code, routes, and environment variables are preserved during this audit phase to prevent unintended regressions, but must be scheduled for complete removal in a separately approved cleanup task.

---

## 7. Audit Logging & Compliance Record

Every credential rotation (routine or emergency) must be formally logged in the engineering audit ledger. The record must include:

1. **Date & Time (UTC):** Exact timestamp of rotation initiation and completion.
2. **Credential Name:** Variable identifier (e.g., `RAZORPAY_KEY_SECRET`).
3. **Rotation Type:** `Routine Scheduled` \| `Emergency Compromise` \| `Offboarding`.
4. **Approver:** Name and role of approving officer(s).
5. **Operator:** Name of engineer executing the rotation.
6. **Provider Confirmation ID:** Key ID or creation fingerprint (never the secret itself).
7. **Verification Timestamp:** Timestamp of successful health check and smoke test execution.
8. **Old Key Revocation Timestamp:** Timestamp the previous credential was deleted in the provider console.

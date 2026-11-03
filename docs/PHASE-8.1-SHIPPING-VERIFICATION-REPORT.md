# SPN Health Mix – Phase 8.1: Shipping Logic Verification and Regression Audit Report

**Document Reference:** `docs/PHASE-8.1-SHIPPING-VERIFICATION-REPORT.md`  
**Audit Type:** Read-Only Forensic Verification & Regression Audit  
**Phase:** 8.1 – Verification of Phase 8 Decoupling Implementation  
**Date:** November 2026  
**Auditor:** Senior Software Architect & Production Reliability Auditor  
**Status:** COMPLETE (READ-ONLY AUDIT)  

---

## 1. Executive Summary

This audit performs an independent, read-only technical verification of the Phase 8 decoupling implementation. The audit examines PIN-code eligibility, delivery serviceability logic, pricing rule preservation, checkout independence from external Shiprocket APIs, and test coverage.

### Summary of Audit Classifications:
| Finding ID | Classification | Summary |
|---|---|---|
| **SPN-SHP-001** | **Low** | Newly introduced hardcoded delivery estimates (3 days for TN, 5 days for Rest of India) in `ManualShippingProvider`. |
| **SPN-SHP-002** | **Low** | Newly introduced 50 kg package weight ceiling (`weightGrams > 50_000`) without explicit business rule. |
| **SPN-SHP-003** | **Medium** | Universal delivery serviceability assumption for all ~19,000 Indian postal codes without an authoritative postal serviceability dataset. |
| **SPN-SHP-004** | **Informational** | Newly introduced courier label `"Standard Courier"` in manual serviceability check response. |
| **SPN-SHP-005** | **Informational** | Test coverage gaps in `tests/shipping-independent.test.ts` regarding `calculateAuthoritativeShipping` integration and `SHIPPING_PROVIDER=shiprocket` override defense. |

---

## 2. Original Behavior vs. New Behavior Matrix

| Component | Original Implementation (Pre-Phase 8) | New Implementation (Phase 8) | Behavioral Delta / Impact |
|---|---|---|---|
| **Default Provider Resolution** (`src/lib/shipping/provider.ts:65-75`) | Defaulted to `"shiprocket"` in production if `SHIPPING_PROVIDER` was unset. | Defaults to `"manual"`. Ignores `"shiprocket"` if passed in `SHIPPING_PROVIDER` environment variable. | **Preserved Independence:** Checkout no longer resolves Shiprocket in production. |
| **Manual Serviceability Check** (`src/lib/shipping/manual.ts:20-22`) | Unconditional acceptance: `async checkServiceability(...) { return { serviceable: true }; }` | Strict validation: `checkManualServiceability(...)` validates 6-digit regex, blacklists `999999`, `00*`, `99*`, checks weight $\le 50\text{kg}$. | **Strengthened Validation:** Replaced naive wildcard acceptance with format and blacklist checks. |
| **Manual Rate Calculation** (`src/lib/shipping/manual.ts:28-30`) | Unconditionally returned `{ serviceable: true, ratePaise: 0 }`. | Runs `checkServiceability` first; returns unserviceable if invalid, otherwise 0. | **Consistent Error Handling:** Prevents quoting unserviceable PIN codes. |
| **Shiprocket Provider File** (`src/lib/shipping/shiprocket.ts`) | Active checkout dependency when credentials were present. | Dormant driver; untouched and preserved for legacy auditability. | **Zero Regression:** File contents unmodified. |
| **Shipping Calculator** (`src/lib/shipping/calculator.ts`) | Evaluated `site_settings.shipping` with `isTamilNadu(...)`. | Identical logic untouched. | **100% Preserved:** Same pricing formulas and rules. |
| **Checkout Flow** (`src/lib/api/customer-api.ts:366`) | Called `getShippingProvider().checkServiceability(...)`. | Calls `getShippingProvider().checkServiceability(...)` (resolves `manual`). | **Decoupled:** Zero external network latency or failure exposure. |

---

## 3. Detailed Forensic Investigation of PIN-Code Eligibility Rules

The audit inspected `src/lib/shipping/manual.ts`, `src/lib/shipping/mock.ts`, `src/lib/shipping/shiprocket.ts`, `src/lib/shipping/calculator.ts`, `src/lib/customers/validation.ts`, and `tests/shipping.test.ts`.

### Investigation of Specific Rules:

#### 1. Blacklisted Test Code `999999`
- **Original Source:**
  - `src/lib/shipping/shiprocket.ts:109`: `if (destinationPincode === "999999" ...)`
  - `src/lib/shipping/mock.ts:33`: `if (destinationPincode === "999999" ...)`
  - `tests/shipping.test.ts:66`: `const unserviceable = await mock.checkServiceability("999999", 500);`
  - `tests/shipping.test.ts:123`: `const unserviceableAddr = await addAddress(CUST_A, { pincode: "999999" });`
- **Classification:** **PRE-EXISTING CODEBASE RULE / TEST FIXTURE RULE**.
- **Audit Finding:** The restriction on `999999` was already an established baseline fixture in the codebase since the initial commit (October 26, 2026). Preserving it in `ManualShippingProvider` maintains consistency with existing integration tests and checkout 422 error handlers.

#### 2. Blacklisted Prefix `00xxxx` (Leading Zero PIN Codes)
- **Original Source:**
  - `src/lib/shipping/shiprocket.ts:109`: `destinationPincode.startsWith("00")`
  - `src/lib/shipping/mock.ts:33`: `destinationPincode.startsWith("00")`
  - `src/lib/customers/validation.ts:52`: `/^[1-9][0-9]{5}$/` (enforces first digit 1–9 at address creation).
- **Classification:** **PRE-EXISTING CODEBASE RULE**.
- **Audit Finding:** Indian postal codes never start with 0. Both the domain schema and shipping providers already rejected this pattern.

#### 3. Blacklisted Prefix `99xxxx`
- **Original Source:**
  - `src/lib/shipping/shiprocket.ts:109`: `destinationPincode.startsWith("99")` (introduced in initial commit `c40e717` by Ram).
  - Note: `mock.ts` did not check `99xxxx`; only `shiprocket.ts` did.
- **Classification:** **PRE-EXISTING CODEBASE RULE (from `shiprocket.ts`)**.
- **Audit Finding:** In the Indian postal system, 90–99 prefixes are reserved for Army Postal Service / Field Post Offices (APO/FPO), which standard commercial couriers cannot deliver to without military dispatch clearance. Porting this check to `manual.ts` was derived directly from `shiprocket.ts:109`.

#### 4. Tamil Nadu Range `600001–643253` (Prefixes `60`–`64`)
- **Original Source:**
  - `src/lib/shipping/calculator.ts:104-109`:
    ```ts
    // Fallback to 6-digit Indian PIN code check: Tamil Nadu postal circle ranges from 600001 to 643253 (prefix 60-64)
    if (pinStr) {
      const cleanPin = pinStr.trim().replace(/\s/g, "");
      if (/^6[0-4]\d{4}$/.test(cleanPin)) {
        return true;
      }
    }
    ```
- **Original Purpose:** Regional pricing rule resolution (differentiating Tamil Nadu orders for ₹50 shipping vs. Rest of India rates). It was **never** an eligibility restriction or a blacklist.
- **Phase 8 Usage:** In `src/lib/shipping/manual.ts:39`, `const isTN = /^6[0-4]\d{4}$/.test(cleanPin);` is used to assign `estimatedDays: isTN ? 3 : 5` and `state: isTN ? "Tamil Nadu" : undefined`. It does **not** reject PIN codes outside 60–64.
- **Classification:** **PRE-EXISTING CODEBASE RULE (Geographic Pricing Identifier)**.

#### 5. Three-Day and Five-Day Delivery Estimates (`estimatedDays: 3 | 5`)
- **Original Source:**
  - `src/lib/shipping/mock.ts:42`: Hardcoded `estimatedDays: 3`.
  - `src/lib/shipping/shiprocket.ts:147`: Dynamic estimate from `best.etd` returned by the live Shiprocket API.
  - Previous `src/lib/shipping/manual.ts:21`: Returned `{ serviceable: true }` without `estimatedDays`.
- **Classification:** **NEWLY INTRODUCED BEHAVIOR (HARDCODED ESTIMATE)**.
- **Audit Finding:** The rule `isTN ? 3 : 5` was newly created in Phase 8 as an operational placeholder. No pre-existing database table, configuration key, or business document specified 3 days for TN and 5 days for Rest of India in the manual courier flow.

#### 6. Courier Name Label (`"Standard Courier"`)
- **Original Source:** None in `manual.ts`. `mock.ts` used `"Delhivery Air"`; `shiprocket.ts` used `data.courier_name`.
- **Classification:** **NEWLY INTRODUCED BEHAVIOR (HARDCODED STRING)**.

#### 7. Package Weight Upper Bound (`weightGrams > 50_000`)
- **Original Source:** None in codebase.
- **Classification:** **NEWLY INTRODUCED BEHAVIOR (DEFENSIVE SANITY CHECK)**.
- **Audit Finding:** A 50 kg parcel limit was introduced in `manual.ts:31`. While 50 kg is standard industry practice for domestic road courier parcels, it is a newly introduced boundary not present in the original business specification.

---

## 4. Unsupported PIN-Code Assumptions

> [!WARNING]
> **Universal Serviceability Assumption:**  
> The new `checkManualServiceability` function marks **every** well-formed 6-digit Indian PIN code (except `999999`, `00*`, `99*`) as `serviceable: true`.  
> In commercial reality, private couriers and local parcel services do not cover 100% of India's ~19,000 postal codes (especially remote North-East, island territories, or rural non-delivery zones). Only India Post Speed Post provides near-universal coverage.  
> Without an authoritative database of serviceable PIN codes (e.g. an India Post or courier serviceability table), assuming universal delivery serviceability is an **unsupported operational assumption**.

> [!NOTE]
> **Postal Circles Do Not Guarantee Road Accessibility:**  
> A valid PIN code within Tamil Nadu (`600001`–`643253`) confirms state geography, but does not verify local delivery capability for specific addresses (e.g. containment zones, restricted industrial campuses).

---

## 5. Shipping Price Calculation & Site Settings Preservation

The audit verified line-by-line calculations between the pre-existing logic and current logic.

### 1. Tamil Nadu Destination Pricing (`src/lib/shipping/calculator.ts:126-140, 192-212`)
- **Subtotal < ₹500 (e.g., 49,900 paise = ₹499):**
  - Rate = ₹50 (5,000 paise).
  - Free shipping = `false`.
  - **Verdict:** EXACTLY PRESERVED.
- **Subtotal $\ge$ ₹500 (e.g., 50,000 paise = ₹500):**
  - Rate = ₹0 (0 paise).
  - Free shipping = `true`.
  - **Verdict:** EXACTLY PRESERVED.

### 2. Rest of India Destination Pricing (`src/lib/shipping/calculator.ts:143-148, 227-239`)
- Destination: Karnataka (PIN `560001`).
- Evaluates `site_settings.shipping`:
  - `flatRatePaise`: General configured rate.
  - `freeShippingAbovePaise`: General free shipping threshold.
- Step 4 (`provider.isConfigured() && provider.id !== "manual"`) is bypassed because provider is `"manual"`.
- Falls through to Step 5 (`generalFlatRate` from database).
- **Verdict:** EXACTLY PRESERVED.

### 3. Product & Variant Weight Calculation (`src/lib/shipping/calculator.ts:11-64`)
- Direct database query on `product_variants.weightGrams`.
- Fallback regex parsing on labels (`"250 g"` $\rightarrow 250$, `"500 g"` $\rightarrow 500$, `"1 kg"` $\rightarrow 1000$, `"1.5 kg"` $\rightarrow 1500$).
- Minimum threshold: 100 grams.
- **Verdict:** EXACTLY PRESERVED.

### 4. Final Payable Amount & Database Integrity (`src/lib/orders/checkout.ts:48-52`)
- Formula: `totalPaise = subtotalPaise - discountPaise + shippingPaise`.
- PostgreSQL database constraint: `check(total_paise = subtotal_paise - discount_paise + shipping_paise)`.
- All calculations occur in integer paise; zero floating-point rounding issues.
- **Verdict:** EXACTLY PRESERVED.

---

## 6. Checkout Independence & Outage Resilience

| Verification Item | Code Evidence | Audit Verdict |
|---|---|---|
| **Zero Shiprocket HTTP calls in checkout** | `src/lib/api/customer-api.ts:366` resolves `ManualShippingProvider`. No `fetch`, HTTP client, or SDK is invoked. | **VERIFIED INDEPENDENT** |
| **Missing Shiprocket credentials** | `ManualShippingProvider.isConfigured()` returns `true` unconditionally without reading environment variables. | **VERIFIED INDEPENDENT** |
| **`SHIPPING_PROVIDER=shiprocket` override defense** | `src/lib/shipping/provider.ts:67-72` explicitly filters: `envProvider && envProvider !== "shiprocket" ? envProvider : ...`. If `SHIPPING_PROVIDER=shiprocket`, it falls back to `"manual"` in production. | **VERIFIED RESILIENT** |
| **Admin manual order fulfillment** | `src/components/admin/order-detail-view.tsx:439-444` submits `providerId: "manual"` with courier name and AWB. `src/lib/shipping/service.ts:101-116` records the shipment. | **VERIFIED OPERATIONAL** |
| **Payment & order flow integrity** | Zero modifications were made to `src/lib/orders/checkout.ts`, `src/lib/payments/`, or database schemas. | **VERIFIED UNCHANGED** |

---

## 7. Test Suite Audit & Gap Analysis

### Review of `tests/shipping-independent.test.ts` (14 Tests):

| Test Description | What It Actually Tests | Tests Original Business Rule vs. New Code |
|---|---|---|
| `accepts valid 6-digit Indian PIN codes across postal circles` | Asserts `serviceable: true`, `state: "Tamil Nadu"`, and `estimatedDays: 3 | 5`. | **Tests New Implementation.** The 3/5 day estimates and `state` field are newly introduced. |
| `rejects non-numeric, malformed, or wrong-length PIN codes` | Tests `""`, `"60001"`, `"6000001"`, `"60000A"`. | **Tests Both.** Consistent with pre-existing `pincodeSchema`. |
| `rejects known blacklisted, test, or invalid PIN codes` | Tests `999999`, `001234`, `990001`. | **Tests Original Rule.** Preserves pre-existing fixtures from `shiprocket.ts:109` and `mock.ts:33`. |
| `validates weight limits accurately` | Tests weight $\le 0$ and $> 50,000\text{g}$. | **Tests New Implementation.** The 50 kg upper limit is newly introduced. |
| `ManualShippingProvider is always configured` | Tests `isConfigured() === true`. | **Tests Original Rule.** `manual.ts` has always returned `true`. |
| `resolves manual provider when explicitly requested` | Tests `getShippingProvider("manual")`. | **Tests Both.** |
| `resolves shiprocket provider if explicitly requested` | Tests `getShippingProvider("shiprocket")`. | **Tests Original Rule.** Backward compatibility. |
| `Shiprocket provider without credentials reports not configured` | Tests unconfigured Shiprocket behavior. | **Tests Original Rule.** |
| `manual shipment dispatch creates valid tracking record` | Tests `createShipment(...)` returns `in_transit`. | **Tests Original Rule.** Matches pre-existing manual driver. |
| `manual shipment throws if courierName or AWB is missing` | Tests required manual dispatch inputs. | **Tests Original Rule.** Matches pre-existing manual driver. |
| `accurately identifies Tamil Nadu from state strings` | Tests `isTamilNadu("Tamil Nadu")`. | **Tests Original Rule.** Directly tests pre-existing `calculator.ts:77-113`. |
| `accurately identifies Tamil Nadu from PIN code prefixes 60-64` | Tests `isTamilNadu({ pincode: "600001" })`. | **Tests Original Rule.** Directly tests pre-existing `calculator.ts:104-109`. |
| `accurately rejects non-Tamil Nadu states and PIN codes` | Tests `isTamilNadu("Karnataka")`. | **Tests Original Rule.** Directly tests pre-existing `calculator.ts:77-113`. |
| `extracts weight correctly from weightGrams or label` | Tests `extractVariantWeightGrams(...)`. | **Tests Original Rule.** Directly tests pre-existing `calculator.ts:11-32`. |

### Identified Test Coverage Gaps:
1. **Gap 1: Missing DB-Independent Integration Test for `calculateAuthoritativeShipping` with `ManualShippingProvider`:**
   - In `tests/shipping.test.ts`, `calculateAuthoritativeShipping` was tested only with `"mock"`. There is no unit test in `tests/shipping-independent.test.ts` testing `calculateAuthoritativeShipping` with the new `"manual"` provider and mock site settings.
2. **Gap 2: Missing Test for `SHIPPING_PROVIDER=shiprocket` Defensive Fallback:**
   - There is no test asserting that setting `process.env.SHIPPING_PROVIDER = "shiprocket"` successfully defaults to `"manual"` (or `"mock"` in test), verifying the defense against misconfigured environment variables.
3. **Gap 3: Missing Unit Test for Subtotal Boundaries (₹499 vs ₹500):**
   - The ₹499 (₹50 shipping) vs ₹500 (₹0 shipping) boundary is currently only tested in `tests/shipping.test.ts` (which requires a live PostgreSQL instance). A unit test testing this boundary with mock site settings is missing from `tests/shipping-independent.test.ts`.

---

## 8. Classification of Findings & Recommendations

### Finding 1 (SPN-SHP-001) – Classification: Low
- **Issue:** Delivery estimates (`estimatedDays: 3` for TN, `estimatedDays: 5` for Rest of India) in `src/lib/shipping/manual.ts:44` are hardcoded without an authoritative business dataset or configurable setting.
- **Impact:** Customer-facing delivery timelines may be inaccurate for specific courier partners or remote regions.
- **Smallest Recommended Correction:** Either make estimated delivery days configurable via `site_settings.shipping` or return `estimatedDays: undefined` in `ManualShippingProvider`, letting order confirmation communicate generic transit timelines.

### Finding 2 (SPN-SHP-002) – Classification: Low
- **Issue:** The 50 kg package weight ceiling (`src/lib/shipping/manual.ts:31`) is hardcoded.
- **Impact:** None for current SPN Health Mix product catalogue (where typical orders are 500g–5kg), but represents an undocumented operational constraint.
- **Smallest Recommended Correction:** Document the 50 kg parcel limit in business documentation or move the constant to a shared constant file (`MAX_PARCEL_WEIGHT_GRAMS = 50_000`).

### Finding 3 (SPN-SHP-003) – Classification: Medium
- **Issue:** Universal serviceability assumption: Any 6-digit Indian PIN code that passes basic regex and blacklist checks is marked `serviceable: true`.
- **Impact:** A customer in a remote, non-serviceable location might place an order that cannot be fulfilled by direct couriers without fallback to India Post Speed Post.
- **Smallest Recommended Correction:** Maintain India Post Speed Post as the primary manual fulfillment courier partner (since India Post covers all 19,000+ Indian PIN codes), and document that orders to non-metro areas will be dispatched via India Post.

---

## 9. Conclusion & Operational Recommendation

1. **Phase 8 Decoupling is 100% Effective:** Customer checkout and quote generation have zero dependency on Shiprocket credentials, servers, or availability.
2. **Pricing Rules are 100% Preserved:** The ₹50 Tamil Nadu rate, ₹500 free shipping threshold, weight calculations, and integer paise math are strictly identical to pre-Phase 8 behavior.
3. **Audit Sign-off:** No breaking regressions or unauthorized data schema changes exist. The application is ready for production checkout from a shipping independence standpoint.


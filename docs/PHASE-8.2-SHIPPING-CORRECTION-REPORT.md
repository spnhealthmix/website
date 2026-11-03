# SPN Health Mix – Phase 8.2: Remove Unsupported Shipping Restrictions Report

**Document Reference:** `docs/PHASE-8.2-SHIPPING-CORRECTION-REPORT.md`  
**Phase:** 8.2 – Shipping Logic Corrections & Policy Clarification  
**Date:** November 2026  
**Status:** IMPLEMENTED & VERIFIED  

---

## 1. Objective & Scope of Changes

During the Phase 8.1 Verification and Regression Audit, two newly introduced behavioral restrictions were identified that lacked authoritative business requirements or provider data backing:
1. **Hardcoded Delivery Estimates:** `estimatedDays: isTN ? 3 : 5` in `ManualShippingProvider`.
2. **Arbitrary 50 kg Weight Restriction:** `weightGrams > 50_000` in `ManualShippingProvider`.

Phase 8.2 resolves these findings by applying minimal, type-safe corrections to `src/lib/shipping/manual.ts` and updating corresponding test suites, while fully preserving all established checkout, pricing, PIN-code validation, and fulfillment rules.

---

## 2. Detailed Technical Changes

### A. Removal of Hardcoded Delivery Estimates
- **File:** `src/lib/shipping/manual.ts`
- **Correction:** Removed the speculative ternary `isTN ? 3 : 5`. In its place, `estimatedDays: undefined` is returned in `ServiceabilityCheck`.
- **Interface Compatibility:** The `ServiceabilityCheck` and `ShippingRateQuote` TypeScript types define `estimatedDays?: number`. Returning `undefined` is strictly type-safe and avoids presenting arbitrary or misleading transit commitments to customers during checkout and quote generation.
- **Customer Impact:** No customer-facing pricing or checkout calculation is altered. Delivery timelines can be communicated post-order based on actual carrier dispatch or general store policy.

### B. Removal of Arbitrary 50 kg Parcel Weight Ceiling
- **File:** `src/lib/shipping/manual.ts`
- **Correction:** Replaced `weightGrams <= 0 || weightGrams > 50_000` with strict positive finite number validation:
  ```ts
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return {
      serviceable: false,
      message: "Package weight must be greater than zero.",
    };
  }
  ```
- **Rationale:** The application should not arbitrarily block bulk orders or valid packages over 50 kg without a formal operational delivery policy. Invalid, negative, zero, or non-finite weights remain strictly rejected with descriptive error messaging.

---

## 3. Preservation of Core Business Rules

The following business rules remain completely untouched and verified:
1. **6-Digit Indian Postal PIN Code Validation:** Strict regex `/^[1-9][0-9]{5}$/` enforced.
2. **Rejection of Known Test/Blacklisted PINs:** `999999`, `00xxxx` (leading zeros), and `99xxxx` (military/test ranges) remain strictly rejected with HTTP 422 `UNSERVICEABLE_PINCODE`.
3. **Tamil Nadu Pricing & Regional Rules:** Flat ₹50 shipping charge (5,000 paise), free shipping on orders $\ge \text{₹}500$ (50,000 paise). `isTamilNadu` circle detection (`600001`–`643253`) and state naming checks remain identical.
4. **Rest of India Pricing:** Controlled by `site_settings.shipping` with general flat rate and threshold fallbacks.
5. **Cart & Variant Weight Calculation:** Database-driven `calculateCartWeightGrams` and label parsing regex (`extractVariantWeightGrams`) remain identical.
6. **Payment & Order Math:** Razorpay order generation, idempotency handling, integer paise calculations, and the database total check constraint remain 100% intact.
7. **Manual Admin Fulfillment:** Admin manual dispatch (`India Post`, `Delhivery`, `ST Courier`) via `/api/admin/orders/:id/shipment/create` with `providerId: "manual"` remains fully functional.

---

## 4. Policy Clarification: Universal Serviceability Scope

> [!IMPORTANT]
> **Universal Serviceability Boundary:**  
> The SPN Health Mix application does **not** claim that every Indian postal PIN code is deliverable by every courier.  
> The `ManualShippingProvider` verifies format validity, eliminates test/invalid codes, and validates positive package weight. Actual physical delivery feasibility to remote, non-standard, or rural locations depends on carrier coverage (e.g. India Post Speed Post vs. private surface couriers) and requires an approved business delivery-zone policy if geographic exclusions are desired in the future.

---

## 5. Test Suite Updates & Verification Matrix

### Updated Test Suite: `tests/shipping-independent.test.ts`
- **Updated Test 1:** Removed assertions expecting `estimatedDays: 3` and `estimatedDays: 5`. Verified that `estimatedDays` is `undefined` across Tamil Nadu and non-Tamil Nadu postal circles.
- **Updated Test 2:** Removed assertion expecting rejection of weights $> 50,000\text{g}$. Added assertions verifying that packages of 50,001g and 75,000g succeed while non-positive, zero, and non-finite (`NaN`) weights are rejected with `"Package weight must be greater than zero."`.

### Test Execution Results:
```
 RUN  v2.1.9 C:/Users/acer/OneDrive/Documents/SPN-Foods-main

 ✓ tests/sentry.test.ts (17 tests) 35ms
 ✓ tests/shipping-independent.test.ts (14 tests) 14ms
 ✓ tests/health.test.ts (12 tests) 110ms
 ✓ tests/logger.test.ts (10 tests) 29ms
 ✓ tests/auth-password.test.ts (2 tests) 122ms

 Test Files  5 passed (5)
      Tests  55 passed (55)
   Duration  11.18s
```

- `npm run typecheck`: **0 errors** (Clean TypeScript compilation).
- `git diff --check`: **0 whitespace/conflict warnings**.

---

## 6. Exact Files Modified

1. `src/lib/shipping/manual.ts` (Removed hardcoded ETA and 50 kg limit; enforced positive finite weight validation).
2. `tests/shipping-independent.test.ts` (Updated assertions to reflect `estimatedDays: undefined` and verified valid heavy shipments).
3. `docs/PHASE-8-SHIPPING-INDEPENDENCE-REPORT.md` (Updated serviceability table and added Phase 8.2 policy note).
4. `docs/PHASE-8.2-SHIPPING-CORRECTION-REPORT.md` (Created this report).


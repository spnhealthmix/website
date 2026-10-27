import { describe, expect, it, vi } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { verifyCheckoutCallback, getMyOrder } from "../src/lib/customers/orders";
import { applyCapturedPayment } from "../src/lib/orders/capture-payment";

describe("Post-Payment Redirect and Order Confirmation Flow", () => {
  const root = path.resolve(__dirname, "..");
  const checkoutFormPath = path.join(root, "src/components/checkout/checkout-form.tsx");
  const checkoutSuccessPagePath = path.join(root, "src/app/(storefront)/checkout/success/page.tsx");

  describe("1. Direct post-payment navigation without Cart intermediate step", () => {
    it("ensures checkout-form navigates directly to the order confirmation page using router.replace", () => {
      const code = fs.readFileSync(checkoutFormPath, "utf-8");

      // Must not redirect to /cart on payment success
      expect(code).not.toMatch(/router\.(push|replace)\(["'`]\/cart["'`]\)/);

      // Must use router.replace to the order confirmation page
      expect(code).toContain("router.replace(");
      expect(code).toContain("/checkout/success?orderId=");

      // Must set isPaymentSuccess state before navigation to prevent empty-cart flash
      expect(code).toContain("setIsPaymentSuccess(true)");
    });

    it("ensures cart-clearing does not flash empty cart UI during order submission or post-payment transition", () => {
      const code = fs.readFileSync(checkoutFormPath, "utf-8");

      // Verify guard against rendering "Your cart is empty" when submitting or when payment is successful
      expect(code).toContain("if (isPaymentSuccess)");
      expect(code).toContain("if (isSubmitting)");

      // Verify that navigation is not blocked by await refreshCart()
      expect(code).not.toMatch(/await\s+refreshCart\(\);\s*router\.(push|replace)\(\s*`\/checkout\/success/);
      expect(code).toContain("void refreshCart()");
    });

    it("verifies canonical order ID and pending status are included in the redirect URL", () => {
      const code = fs.readFileSync(checkoutFormPath, "utf-8");

      // Must use canonical server verified order ID or orderNumber
      expect(code).toContain("const confirmedOrderId = verifyData.orderId || orderId");
      expect(code).toContain("const confirmedOrderNumber = verifyData.orderNumber || orderNumber");
      expect(code).toContain("isPending ? \"&pending=true\" : \"\"");
    });
  });

  describe("2. Server-side payment verification & safe payment states", () => {
    it("ensures navigation happens only after server-side payment verification", () => {
      const code = fs.readFileSync(checkoutFormPath, "utf-8");

      // Must call /api/checkout/verify before redirecting
      expect(code).toContain('fetch("/api/checkout/verify"');
      expect(code).toContain("if (!verifyRes.ok || !verifyData.verified)");
      expect(code).toContain("/checkout/failure?orderId=");
    });

    it("routes failed or network-error payments safely to failure/pending handler without false success", () => {
      const code = fs.readFileSync(checkoutFormPath, "utf-8");

      expect(code).toContain("/checkout/failure?orderId=");
      expect(code).toContain("&pending=true");
      expect(code).toContain("Payment verification network error");
    });
  });

  describe("3. Order details authorization and ownership verification", () => {
    it("verifies CheckoutSuccessPage strictly requires active authenticated session matching order profileId", () => {
      const code = fs.readFileSync(checkoutSuccessPagePath, "utf-8");

      // Must check that session exists and matches order.profileId
      expect(code).toContain("!session || order.profileId !== session.profile.id");
      expect(code).toContain("orderNotFound = true");
      expect(code).toContain("isAuthorized = false");

      // Must not fall back to displaying success for unauthenticated requests with arbitrary orderNumber
      expect(code).not.toContain("} else if (!orderNumber) {\n        orderNotFound = true;");
    });

    it("verifies getMyOrder throws ORDER_NOT_FOUND when customer does not own the order", async () => {
      const mockDb: any = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            where: vi.fn().mockResolvedValue([]), // Returns empty array for mismatched profile
          })),
        })),
      };

      await expect(getMyOrder(mockDb, "customer_alice", "order_bob_123")).rejects.toThrow(
        "Order not found."
      );
    });

    it("verifies verifyCheckoutCallback throws ORDER_NOT_FOUND when order does not belong to profile", async () => {
      const mockDb: any = {
        select: vi.fn(() => ({
          from: vi.fn(() => ({
            innerJoin: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([]), // Mismatched customer profile
            })),
          })),
        })),
      };

      await expect(
        verifyCheckoutCallback(
          mockDb,
          "intruder_user_id",
          {
            razorpayOrderId: "order_rzp_123",
            razorpayPaymentId: "pay_rzp_123",
            signature: "sig_dummy",
          },
          "secret"
        )
      ).rejects.toThrow("Order not found.");
    });
  });

  describe("4. Idempotency against duplicate payment callbacks", () => {
    it("returns already_processed on duplicate captured payments without duplicate order creation", async () => {
      const mockDb: any = {
        transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
          const tx: any = {
            select: vi.fn(() => ({
              from: vi.fn(() => ({
                where: vi.fn(() => ({
                  for: vi.fn().mockResolvedValue([
                    {
                      id: "pay_1",
                      orderId: "ord_1",
                      razorpayOrderId: "order_rzp_123",
                      razorpayPaymentId: "pay_rzp_123",
                      status: "captured", // already captured
                      amountPaise: 50000,
                    },
                  ]),
                })),
              })),
            })),
          };

          // Link lookup
          tx.select.mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn().mockResolvedValue([{ orderId: "ord_1" }]),
            })),
          });

          // Order row lookup
          tx.select.mockReturnValueOnce({
            from: vi.fn(() => ({
              where: vi.fn(() => ({
                for: vi.fn().mockResolvedValue([{ id: "ord_1", totalPaise: 50000, status: "confirmed" }]),
              })),
            })),
          });

          return cb(tx);
        }),
      };

      const result = await applyCapturedPayment(mockDb, {
        razorpayOrderId: "order_rzp_123",
        razorpayPaymentId: "pay_rzp_123",
        amountPaise: 50000,
      });

      expect(result.outcome).toBe("already_processed");
      expect(result.orderId).toBe("ord_1");
    });
  });

  describe("5. Insecure payment endpoints remain decommissioned", () => {
    it("confirms deleted standalone routes and demo button remain deleted", () => {
      const forbiddenPaths = [
        path.join(root, "src/app/api/create-order/route.ts"),
        path.join(root, "src/app/api/create-order"),
        path.join(root, "src/app/api/verify-payment/route.ts"),
        path.join(root, "src/app/api/verify-payment"),
        path.join(root, "src/app/(storefront)/checkout/razorpay/page.tsx"),
        path.join(root, "src/app/(storefront)/checkout/razorpay"),
        path.join(root, "src/components/checkout/razorpay-checkout-button.tsx"),
      ];

      for (const p of forbiddenPaths) {
        expect(fs.existsSync(p), `Forbidden path must not exist: ${p}`).toBe(false);
      }
    });
  });
});

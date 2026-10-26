import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { cookies } from "next/headers";
import { eq, and } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { orders, orderItems, productImages, payments } from "@/lib/db/schema";
import { SESSION_COOKIE_NAME, validateSession } from "@/lib/auth/session";
import { SuccessCartSync } from "@/components/checkout/success-cart-sync";
import { imageUrl } from "@/lib/storage/storage";
import { formatPrice } from "@/lib/utils";
import {
  CheckCircle2,
  Package,
  Truck,
  Check,
  Clock,
  AlertCircle,
  ArrowRight,
  ShoppingBag,
  ExternalLink,
  MapPin,
  Calendar,
  CreditCard,
} from "lucide-react";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order Confirmed — SPN Health Mix",
  description: "Your order has been placed and confirmed.",
};

interface SuccessPageProps {
  searchParams: Promise<{
    orderId?: string;
    orderNumber?: string;
    pending?: string;
  }>;
}

export default async function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  const { orderId, orderNumber, pending } = await searchParams;
  const isPendingQuery = pending === "true";

  const databaseUrl = process.env.DATABASE_URL;
  const imageBaseUrl = process.env.R2_PUBLIC_BASE_URL;

  let orderData: any = null;
  let itemsData: any[] = [];
  let isAuthorized = false;
  let orderNotFound = false;

  if (orderId && databaseUrl) {
    try {
      const db = getDb(databaseUrl);

      // Authenticate active session from secure cookie
      const cookieStore = await cookies();
      const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;
      const session = sessionToken ? await validateSession(db, sessionToken) : null;

      // Query order with ownership validation if user is logged in
      const [order] = await db
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          profileId: orders.profileId,
          status: orders.status,
          subtotalPaise: orders.subtotalPaise,
          discountPaise: orders.discountPaise,
          shippingPaise: orders.shippingPaise,
          totalPaise: orders.totalPaise,
          shippingAddress: orders.shippingAddress,
          customerNote: orders.customerNote,
          createdAt: orders.createdAt,
          expiresAt: orders.expiresAt,
        })
        .from(orders)
        .where(eq(orders.id, orderId));

      if (order) {
        // Strict ownership check: if session exists, verify profileId matches
        if (session && order.profileId !== session.profile.id) {
          orderNotFound = true;
          isAuthorized = false;
        } else {
          isAuthorized = true;
          orderData = order;

          // Fetch items for this order with primary product images
          const rawItems = await db
            .select({
              id: orderItems.id,
              productId: orderItems.productId,
              productName: orderItems.productName,
              variantLabel: orderItems.variantLabel,
              sku: orderItems.sku,
              unitPricePaise: orderItems.unitPricePaise,
              quantity: orderItems.quantity,
              lineTotalPaise: orderItems.lineTotalPaise,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

          // Fetch images for purchased products
          const productIds = rawItems.map((i) => i.productId).filter(Boolean) as string[];
          const imagesMap = new Map<string, string | null>();

          if (productIds.length > 0) {
            const imgs = await db
              .select({
                productId: productImages.productId,
                r2Key: productImages.r2Key,
              })
              .from(productImages)
              .where(eq(productImages.isPrimary, true));

            for (const img of imgs) {
              if (img.productId && img.r2Key) {
                imagesMap.set(img.productId, imageUrl(imageBaseUrl, img.r2Key));
              }
            }
          }

          itemsData = rawItems.map((item) => ({
            ...item,
            imageUrl: item.productId ? imagesMap.get(item.productId) ?? null : null,
          }));
        }
      } else if (!orderNumber) {
        orderNotFound = true;
      }
    } catch (err) {
      console.error("Error reading order in CheckoutSuccessPage:", err);
      orderNotFound = true;
    }
  } else if (!orderNumber) {
    orderNotFound = true;
  }

  // Derive order and payment status
  const currentStatus = orderData?.status ?? (isPendingQuery ? "pending_payment" : "confirmed");
  const isCancelled = currentStatus === "cancelled";
  const isPending = isPendingQuery || currentStatus === "pending_payment";
  const isSuccess = !orderNotFound && !isCancelled && !isPending;

  const displayOrderNumber = orderData?.orderNumber || orderNumber;
  const formattedDate = orderData?.createdAt
    ? new Date(orderData.createdAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : new Date().toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

  // Calculate order progress steps
  const progressSteps = [
    {
      id: "confirmed",
      label: "Order Confirmed",
      done: isSuccess || currentStatus === "processing" || currentStatus === "shipped" || currentStatus === "delivered",
      active: isSuccess && currentStatus === "confirmed",
    },
    {
      id: "processing",
      label: "Processing",
      done: currentStatus === "processing" || currentStatus === "shipped" || currentStatus === "delivered",
      active: currentStatus === "processing",
    },
    {
      id: "shipped",
      label: "Shipped",
      done: currentStatus === "shipped" || currentStatus === "delivered",
      active: currentStatus === "shipped",
    },
    {
      id: "delivered",
      label: "Delivered",
      done: currentStatus === "delivered",
      active: currentStatus === "delivered",
    },
  ];

  return (
    <div className="min-h-[80vh] bg-[var(--color-bg,#FAF7F2)] py-10 sm:py-16 px-4 sm:px-6 lg:px-8">
      {/* Immediate authoritative cart synchronization with header badge */}
      <SuccessCartSync />

      <div className="mx-auto max-w-2xl">
        {/* Fallback 1: Order Not Found / Unauthorized */}
        {orderNotFound ? (
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border,#E8DFD6)] bg-white p-8 sm:p-12 text-center shadow-[var(--shadow-sm,0_2px_8px_rgba(0,0,0,0.04))]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-orange-50 text-[var(--color-brand-primary,#B4491F)]">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-5 font-heading text-2xl font-normal text-[var(--color-text-primary,#2D241E)] sm:text-3xl">
              No Active Order Found
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted,#786B62)] max-w-md mx-auto">
              We couldn't retrieve this order reference. Please check your account order history or explore our traditional health mixes.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/shop"
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-primary,#B4491F)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-all"
              >
                <span>Browse Products</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/account"
                className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[var(--color-border,#E8DFD6)] bg-white px-6 py-3 text-sm font-semibold text-[var(--color-text-primary,#2D241E)] hover:bg-[#FAF7F2] transition-all"
              >
                My Account
              </Link>
            </div>
          </div>
        ) : isCancelled ? (
          /* Fallback 2: Order Cancelled */
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border,#E8DFD6)] bg-white p-8 sm:p-12 text-center shadow-[var(--shadow-sm,0_2px_8px_rgba(0,0,0,0.04))]">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
              <AlertCircle className="h-7 w-7" />
            </div>
            <h1 className="mt-5 font-heading text-2xl font-normal text-[var(--color-text-primary,#2D241E)] sm:text-3xl">
              Order Was Cancelled
            </h1>
            <p className="mt-2 text-sm text-[var(--color-text-muted,#786B62)] max-w-md mx-auto">
              This order could not be completed or payment was interrupted. All items have been safely returned to stock.
            </p>
            {displayOrderNumber && (
              <p className="mt-4 font-mono text-xs text-[var(--color-text-muted,#786B62)] bg-[#FAF7F2] py-1.5 px-3 rounded-md inline-block">
                Reference: #{displayOrderNumber}
              </p>
            )}
            <div className="mt-8 flex justify-center">
              <Link
                href="/shop"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-brand-primary,#B4491F)] px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-95 transition-all"
              >
                <span>Return to Shop</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ) : (
          /* Main Premium Success Layout */
          <div className="overflow-hidden rounded-2xl border border-[var(--color-border,#E8DFD6)] bg-white shadow-[var(--shadow-sm,0_2px_8px_rgba(0,0,0,0.04))]">
            {/* Header Success Section */}
            <div className="p-6 sm:p-10 text-center border-b border-[var(--color-border,#E8DFD6)]/70 bg-gradient-to-b from-[#FAF7F2]/60 to-white">
              {/* Animated Success Badge */}
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#EBF5ED] text-[#2E7D32] border border-[#C8E6C9] shadow-xs animate-in zoom-in-75 duration-300">
                {isPending ? (
                  <Clock className="h-8 w-8 text-amber-600" />
                ) : (
                  <CheckCircle2 className="h-8 w-8 text-[#2E7D32]" />
                )}
              </div>

              <h1 className="mt-5 font-heading text-2xl sm:text-3xl font-normal text-[var(--color-text-primary,#2D241E)] tracking-tight">
                {isPending ? "Payment Pending Confirmation" : "Thank You for Your Order!"}
              </h1>

              <p className="mt-2 text-sm sm:text-base text-[var(--color-text-muted,#786B62)] font-[family-name:var(--font-body)] max-w-md mx-auto leading-relaxed">
                {isPending
                  ? "Your payment is currently being confirmed with the payment provider. We will update your order status as soon as confirmation is received."
                  : "Your payment was successful. We've received your order and will keep you updated on its progress."}
              </p>

              {/* Status Pill */}
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold bg-[#EBF5ED] text-[#2E7D32] border border-[#C8E6C9]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#2E7D32] animate-pulse" />
                <span>{isPending ? "Awaiting Webhook Confirmation" : "Payment Confirmed via Razorpay"}</span>
              </div>
            </div>

            {/* Order Progress Indicator */}
            <div className="px-6 py-6 sm:px-10 border-b border-[var(--color-border,#E8DFD6)]/70 bg-[#FAF7F2]/30">
              <h2 className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-4">
                Order Status
              </h2>

              <div className="relative">
                {/* Connecting Track */}
                <div className="absolute top-3.5 left-4 right-4 h-0.5 bg-[var(--color-border,#E8DFD6)] -z-0" />

                <div className="relative z-10 flex justify-between">
                  {progressSteps.map((step, idx) => (
                    <div key={step.id} className="flex flex-col items-center text-center max-w-[80px]">
                      <div
                        className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all ${
                          step.done
                            ? "bg-[#2E7D32] text-white shadow-xs"
                            : step.active
                            ? "bg-[var(--color-brand-primary,#B4491F)] text-white shadow-xs ring-4 ring-orange-100"
                            : "bg-white border-2 border-[var(--color-border,#E8DFD6)] text-[var(--color-text-muted,#786B62)]"
                        }`}
                      >
                        {step.done ? <Check className="h-4 w-4" /> : idx + 1}
                      </div>
                      <span
                        className={`mt-2 text-[11px] sm:text-xs font-medium leading-tight ${
                          step.done || step.active
                            ? "text-[var(--color-text-primary,#2D241E)] font-semibold"
                            : "text-[var(--color-text-muted,#786B62)]"
                        }`}
                      >
                        {step.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Order Summary & Details Card */}
            <div className="p-6 sm:p-10 space-y-6">
              {/* Reference Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[#FAF7F2]/80 border border-[var(--color-border,#E8DFD6)]/80 text-xs font-[family-name:var(--font-body)]">
                <div>
                  <span className="text-[var(--color-text-muted,#786B62)] block">Order Number</span>
                  <span className="font-semibold text-sm text-[var(--color-text-primary,#2D241E)] font-order-id mt-0.5 block">
                    #{displayOrderNumber || "—"}
                  </span>
                </div>

                <div>
                  <span className="text-[var(--color-text-muted,#786B62)] block">Order Date</span>
                  <span className="font-medium text-sm text-[var(--color-text-primary,#2D241E)] mt-0.5 block">
                    {formattedDate}
                  </span>
                </div>

                <div>
                  <span className="text-[var(--color-text-muted,#786B62)] block">Payment Status</span>
                  <span className="font-medium text-sm text-[#2E7D32] mt-0.5 block">
                    {isPending ? "Pending" : "Paid"}
                  </span>
                </div>

                <div>
                  <span className="text-[var(--color-text-muted,#786B62)] block">Total Paid</span>
                  <span className="font-bold text-sm text-[var(--color-text-primary,#2D241E)] font-price mt-0.5 block">
                    {orderData ? formatPrice(orderData.totalPaise) : "₹—"}
                  </span>
                </div>
              </div>

              {/* Delivery Address Summary */}
              {orderData?.shippingAddress && (
                <div className="rounded-xl border border-[var(--color-border,#E8DFD6)] p-4 sm:p-5 bg-white">
                  <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-2">
                    <MapPin className="h-4 w-4 text-[var(--color-brand-primary,#B4491F)]" />
                    <span>Shipping Address</span>
                  </div>
                  <p className="text-sm font-semibold text-[var(--color-text-primary,#2D241E)]">
                    {orderData.shippingAddress.fullName}
                  </p>
                  <p className="text-xs text-[var(--color-text-body,#52453C)] mt-0.5 leading-relaxed">
                    {orderData.shippingAddress.line1}
                    {orderData.shippingAddress.line2 ? `, ${orderData.shippingAddress.line2}` : ""}
                    {orderData.shippingAddress.landmark ? ` (${orderData.shippingAddress.landmark})` : ""}
                    <br />
                    {orderData.shippingAddress.city}, {orderData.shippingAddress.state} —{" "}
                    {orderData.shippingAddress.pincode}
                  </p>
                  <p className="text-xs text-[var(--color-text-muted,#786B62)] mt-1.5">
                    Phone: {orderData.shippingAddress.phone}
                  </p>
                </div>
              )}

              {/* Compact Purchased Products List */}
              {itemsData.length > 0 && (
                <div className="rounded-xl border border-[var(--color-border,#E8DFD6)] p-4 sm:p-5 bg-white">
                  <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[var(--color-text-muted,#786B62)] mb-3">
                    <span>Items in this Order ({itemsData.length})</span>
                    <span>Total</span>
                  </div>

                  <div className="divide-y divide-[var(--color-border,#E8DFD6)]/60">
                    {itemsData.map((item) => (
                      <div key={item.id} className="py-3 flex items-center justify-between gap-3 text-sm">
                        <div className="flex items-center gap-3">
                          <div className="relative h-12 w-12 rounded-lg border border-[var(--color-border,#E8DFD6)] bg-[#FAF7F2] overflow-hidden shrink-0 flex items-center justify-center">
                            {item.imageUrl ? (
                              <Image
                                src={item.imageUrl}
                                alt={item.productName}
                                fill
                                sizes="48px"
                                className="object-cover"
                              />
                            ) : (
                              <Package className="h-5 w-5 text-[var(--color-text-muted,#786B62)]" />
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary,#2D241E)] leading-tight">
                              {item.productName}
                            </p>
                            <p className="text-xs text-[var(--color-text-muted,#786B62)] mt-0.5">
                              {item.variantLabel} × {item.quantity}
                            </p>
                          </div>
                        </div>
                        <span className="font-semibold text-xs sm:text-sm text-[var(--color-text-primary,#2D241E)] shrink-0">
                          {formatPrice(item.lineTotalPaise)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Financial Breakdown */}
                  {orderData && (
                    <div className="mt-3 pt-3 border-t border-[var(--color-border,#E8DFD6)] space-y-1.5 text-xs text-[var(--color-text-muted,#786B62)]">
                      <div className="flex justify-between">
                        <span>Subtotal</span>
                        <span className="font-price font-medium">{formatPrice(orderData.subtotalPaise)}</span>
                      </div>
                      {orderData.discountPaise > 0 && (
                        <div className="flex justify-between text-[#2E7D32] font-medium font-price">
                          <span>Discount Savings</span>
                          <span>−{formatPrice(orderData.discountPaise)}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span>Shipping</span>
                        <span className="font-price font-medium">{orderData.shippingPaise === 0 ? "Free" : formatPrice(orderData.shippingPaise)}</span>
                      </div>
                      <div className="flex justify-between pt-1.5 border-t border-[var(--color-border,#E8DFD6)]/80 text-sm font-bold text-[var(--color-text-primary,#2D241E)]">
                        <span>Total Paid</span>
                        <span className="font-price">{formatPrice(orderData.totalPaise)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3">
                {orderData?.id ? (
                  <Link
                    href={`/account/orders/${orderData.id}`}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-primary,#B4491F)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
                  >
                    <span>View Order Details</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link
                    href="/account/profile"
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--color-brand-primary,#B4491F)] px-6 py-3.5 text-sm font-semibold text-white shadow-sm hover:opacity-95 active:scale-[0.99] transition-all"
                  >
                    <span>View in My Account</span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                )}

                <Link
                  href="/shop"
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--color-border,#E8DFD6)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--color-text-primary,#2D241E)] hover:bg-[#FAF7F2] active:scale-[0.99] transition-all"
                >
                  <ShoppingBag className="h-4 w-4 text-[var(--color-text-muted,#786B62)]" />
                  <span>Continue Shopping</span>
                </Link>
              </div>

              {/* Helper text */}
              <p className="text-center text-xs text-[var(--color-text-muted,#786B62)] pt-1">
                A confirmation email has been sent to your registered address. Need help? Contact us at{" "}
                <span className="font-semibold text-[var(--color-text-primary,#2D241E)]">spnhealthmix@gmail.com</span>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

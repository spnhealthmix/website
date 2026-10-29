"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Package,
  Clock,
  History,
  CreditCard,
  Truck,
  User,
  MapPin,
  Pencil,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  ArrowRight,
  RefreshCw,
  X,
  Printer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_BUSINESS_SETTINGS, type BusinessSettings } from "@/lib/settings/types";

type OrderItem = {
  id: string;
  orderId: string;
  productId: string | null;
  variantId: string | null;
  productName?: string;
  title?: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPricePaise?: number;
  pricePaise?: number;
  lineTotalPaise?: number;
  totalPaise?: number;
};

type Payment = {
  id: string;
  razorpayOrderId?: string;
  razorpayPaymentId: string | null;
  status: string;
  amountPaise: number;
  method: string | null;
  createdAt: string;
};

type Shipment = {
  id: string;
  provider?: string;
  courierName: string | null;
  awb: string | null;
  trackingUrl: string | null;
  status: string;
  shippedAt: string | null;
  deliveredAt: string | null;
  events?: Array<{
    id: string;
    status: string;
    description: string | null;
    location?: string | null;
    occurredAt: string;
  }>;
};

type AuditActivity = {
  id: string;
  action: string;
  details: any;
  createdAt: string;
  actor: {
    id: string;
    email: string;
  } | null;
};

type OrderDetail = {
  id: string;
  orderNumber: string;
  status: string;
  notes?: string | null;
  adminNote?: string | null;
  customerNote?: string | null;
  attentionReason?: string | null;
  subtotalPaise: number;
  shippingPaise?: number;
  shippingAmountPaise?: number;
  discountPaise: number;
  totalPaise: number;
  couponId?: string | null;
  couponCode?: string | null;
  createdAt: string;
  shippingAddress: {
    fullName: string;
    phone: string;
    line1: string;
    line2?: string | null;
    landmark?: string | null;
    city: string;
    state: string;
    pincode?: string;
    postalCode?: string;
    country?: string;
  };
  customer: {
    id: string;
    name: string | null;
    email: string;
    phone: string | null;
  };
  items: OrderItem[];
  payments: Payment[];
  shipments: Shipment[];
  activity: AuditActivity[];
};

const STATUS_CONFIG: Record<
  string,
  { label: string; description: string; badgeClass: string }
> = {
  pending_payment: {
    label: "Pending Payment",
    description: "Payment is pending from the customer.",
    badgeClass: "bg-[#FDF4ED] text-[#BF5330] border-[#F0DCD3]",
  },
  confirmed: {
    label: "Confirmed",
    description: "Payment confirmed. Order is queued for packaging.",
    badgeClass: "bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]",
  },
  processing: {
    label: "Processing",
    description: "Order is currently being processed and prepared.",
    badgeClass: "bg-[#FEF6EE] text-[#B93815] border-[#F9DBAF]",
  },
  packed: {
    label: "Packed",
    description: "Items are packed and ready for carrier dispatch.",
    badgeClass: "bg-[#F4F3FF] text-[#5925DC] border-[#D9D6FE]",
  },
  shipped: {
    label: "Shipped",
    description: "Consignment dispatched with courier tracking.",
    badgeClass: "bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]",
  },
  delivered: {
    label: "Delivered",
    description: "Shipment successfully delivered to the customer.",
    badgeClass: "bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]",
  },
  cancelled: {
    label: "Cancelled",
    description: "Order was cancelled and inventory released.",
    badgeClass: "bg-[#FEF3F2] text-[#B42318] border-[#FECDCA]",
  },
  refunded: {
    label: "Refunded",
    description: "Order was refunded back to customer payment source.",
    badgeClass: "bg-[#FEF6EE] text-[#C4320A] border-[#F9DBAF]",
  },
};

const FORWARD_SEQUENCE = ["confirmed", "processing", "packed", "shipped", "delivered"];
const CANCELLABLE_STATUSES = ["pending_payment", "confirmed", "processing", "packed"];

/** Safely formats integer paise into Indian Rupee string without NaN */
function safeFormatPrice(paise: number | null | undefined): string {
  if (paise === null || paise === undefined || isNaN(Number(paise))) {
    return "₹0";
  }
  const num = Number(paise);
  const rupees = Math.round(num / 100);
  return `₹${rupees.toLocaleString("en-IN")}`;
}

/** Generates product image URL from slug matching public/products catalogue */
function getProductImage(productName: string): string {
  const slug = (productName || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  return `/products/${slug}/main.jpg`;
}

export function OrderDetailView({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Status Modal
  const [statusModalOpen, setStatusModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<string>("");
  const [cancelReason, setCancelReason] = useState("");
  const [courierName, setCourierName] = useState("");
  const [awb, setAwb] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);

  // Shipment Tracking Form
  const [editingShipment, setEditingShipment] = useState(false);
  const [shipCourier, setShipCourier] = useState("");
  const [shipAwb, setShipAwb] = useState("");
  const [shipUrl, setShipUrl] = useState("");
  const [savingShipment, setSavingShipment] = useState(false);
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [syncingTracking, setSyncingTracking] = useState(false);
  const [shipmentError, setShipmentError] = useState<string | null>(null);

  // Business Settings for Shipping Address Slip (Company Phone & Address)
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings>(DEFAULT_BUSINESS_SETTINGS);

  useEffect(() => {
    fetch("/api/admin/settings/business", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data === "object") {
          setBusinessSettings((prev) => ({
            ...prev,
            ...data,
            address: {
              ...prev.address,
              ...(data.address || {}),
            },
          }));
        }
      })
      .catch(() => {});
  }, []);

  const fetchOrder = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, { cache: "no-store" });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Failed to load order.");
      }
      const data: OrderDetail = await res.json();
      setOrder(data);
      if (data.shipments && data.shipments.length > 0) {
        setShipCourier(data.shipments[0].courierName || "");
        setShipAwb(data.shipments[0].awb || "");
        setShipUrl(data.shipments[0].trackingUrl || "");
      }
    } catch (err: any) {
      setError(err.message || "Failed to load order");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrder();
  }, [orderId]);

  // Open Status Transition Modal
  const openStatusTransition = (nextStatus: string) => {
    setTargetStatus(nextStatus);
    setCancelReason("");
    setCourierName(order?.shipments?.[0]?.courierName || "India Post / Delhivery");
    setAwb(order?.shipments?.[0]?.awb || "");
    setTrackingUrl(order?.shipments?.[0]?.trackingUrl || "");
    setTransitionError(null);
    setStatusModalOpen(true);
  };

  // Execute Status Transition
  const handleTransitionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTransitioning(true);
    setTransitionError(null);

    const payload: any = {
      to: targetStatus,
    };

    if (targetStatus === "cancelled") {
      if (!cancelReason.trim()) {
        setTransitionError("A cancellation reason is required.");
        setTransitioning(false);
        return;
      }
      payload.note = cancelReason.trim();
    }

    if (targetStatus === "shipped") {
      if (!courierName.trim() || !awb.trim()) {
        setTransitionError("Courier name and AWB tracking number are required to dispatch.");
        setTransitioning(false);
        return;
      }
      payload.shipment = {
        courierName: courierName.trim(),
        awb: awb.trim(),
        trackingUrl: trackingUrl.trim() || null,
      };
    }

    try {
      const res = await fetch(`/api/admin/orders/${orderId}/status`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);

      if (!res.ok) {
        const fields = resData?.error?.fields;
        const fieldError =
          fields && typeof fields === "object"
            ? Object.entries(fields)
                .map(([field, msg]) => `${field}: ${msg}`)
                .join(", ")
            : null;
        throw new Error(fieldError || resData?.error?.message || "Failed to update order status.");
      }

      setActionSuccess(`Order updated to ${targetStatus}.`);
      setTimeout(() => setActionSuccess(null), 4000);
      setStatusModalOpen(false);
      await fetchOrder();
    } catch (err: any) {
      setTransitionError(err.message || "Status update failed");
    } finally {
      setTransitioning(false);
    }
  };

  // Update or Create Shipment Tracking Details
  const handleSaveShipment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingShipment(true);
    setShipmentError(null);
    try {
      const isExisting = Boolean(order?.shipments && order.shipments.length > 0);
      const endpoint = isExisting
        ? `/api/admin/orders/${orderId}/shipment`
        : `/api/admin/orders/${orderId}/shipment/create`;
      const method = isExisting ? "PATCH" : "POST";

      const payload = isExisting
        ? {
            courierName: shipCourier.trim(),
            awb: shipAwb.trim(),
            trackingUrl: shipUrl.trim() || null,
          }
        : {
            providerId: "manual",
            courierName: shipCourier.trim(),
            awb: shipAwb.trim(),
            trackingUrl: shipUrl.trim() || undefined,
          };

      const res = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify(payload),
      });

      const resData = await res.json().catch(() => null);
      if (!res.ok) throw new Error(resData?.error?.message || "Failed to save shipment.");

      setActionSuccess(isExisting ? "Shipment tracking updated." : "Shipment created successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      setEditingShipment(false);
      await fetchOrder();
    } catch (err: any) {
      setShipmentError(err.message || "Failed to save shipment");
    } finally {
      setSavingShipment(false);
    }
  };

  const handleCreateShipment = async (providerId: string = "shiprocket") => {
    setCreatingShipment(true);
    setShipmentError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
        body: JSON.stringify({ providerId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Failed to create shipment.");
      setActionSuccess("Shipment generated successfully.");
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchOrder();
    } catch (err: any) {
      setShipmentError(err.message || "Failed to create shipment");
    } finally {
      setCreatingShipment(false);
    }
  };

  const handleSyncTracking = async () => {
    setSyncingTracking(true);
    setShipmentError(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/shipment/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: window.location.origin,
        },
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error?.message || "Failed to refresh tracking.");
      setActionSuccess(`Tracking refreshed: ${data.newEventsCount ?? 0} new updates recorded.`);
      setTimeout(() => setActionSuccess(null), 4000);
      await fetchOrder();
    } catch (err: any) {
      setShipmentError(err.message || "Failed to refresh tracking");
    } finally {
      setSyncingTracking(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 max-w-6xl font-[family-name:var(--font-body)]">
        <div className="h-5 w-40 bg-[#E8DFD4]/50 animate-pulse rounded" />
        <div className="flex justify-between items-center">
          <div className="h-9 w-64 bg-[#E8DFD4]/50 animate-pulse rounded" />
          <div className="h-9 w-32 bg-[#E8DFD4]/50 animate-pulse rounded" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-6">
            <div className="h-72 bg-white border border-[#E8DFD4] rounded-[10px] animate-pulse" />
            <div className="h-32 bg-white border border-[#E8DFD4] rounded-[10px] animate-pulse" />
          </div>
          <div className="lg:col-span-4 space-y-6">
            <div className="h-28 bg-white border border-[#E8DFD4] rounded-[10px] animate-pulse" />
            <div className="h-40 bg-white border border-[#E8DFD4] rounded-[10px] animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="p-6 rounded-[10px] border border-[#FECDCA] bg-[#FEF3F2] text-[#B42318] max-w-xl font-[family-name:var(--font-body)]">
        <h2 className="text-base font-semibold mb-1">Failed to load order</h2>
        <p className="text-xs mb-4">{error || "Order not found."}</p>
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-[6px] bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors"
        >
          &larr; Back to Orders List
        </Link>
      </div>
    );
  }

  const statusCfg = STATUS_CONFIG[order.status] || {
    label: order.status,
    description: "Current operational state of this order.",
    badgeClass: "bg-[#FDF4ED] text-[#BF5330] border-[#F0DCD3]",
  };

  const currentForwardIndex = FORWARD_SEQUENCE.indexOf(order.status);
  const nextForwardStatus =
    currentForwardIndex >= 0 && currentForwardIndex < FORWARD_SEQUENCE.length - 1
      ? FORWARD_SEQUENCE[currentForwardIndex + 1]
      : null;
  const isCancellable = CANCELLABLE_STATUSES.includes(order.status);

  // Financial calculations with robust fallbacks
  const subtotalPaise =
    order.subtotalPaise ??
    order.items.reduce(
      (sum, item) =>
        sum +
        (item.lineTotalPaise ??
          item.totalPaise ??
          (item.unitPricePaise ?? item.pricePaise ?? 0) * (item.quantity || 1)),
      0
    );

  const shippingPaise = order.shippingPaise ?? order.shippingAmountPaise ?? 0;
  const discountPaise = order.discountPaise ?? 0;
  const totalPaise = order.totalPaise ?? Math.max(0, subtotalPaise - discountPaise + shippingPaise);
  const totalQuantity = order.items.reduce((acc, it) => acc + (it.quantity || 1), 0);

  // Address postal code fallback
  const pincode =
    order.shippingAddress?.pincode || (order.shippingAddress as any)?.postalCode || "";

  return (
    <div className="max-w-6xl font-[family-name:var(--font-body)] text-[#1A1614]">
      {/* ── Screen-only Order Details Content ────────────────────────────────── */}
      <div className="space-y-6 print:hidden">
        {/* ── Breadcrumb ──────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 text-xs text-[#635850]">
          <Link href="/admin/orders" className="hover:text-[#BF5330] transition-colors">
            Orders
          </Link>
        <ChevronRight className="w-3.5 h-3.5 text-[#8A7E74]" />
        <span className="text-[#1A1614] font-medium font-order-id">{order.orderNumber}</span>
      </div>

      {/* ── Order Header ────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-2">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-order-id text-2xl sm:text-3xl font-bold tracking-tight text-[#1A1614]">
              {order.orderNumber}
            </h1>
            <span
              className={cn(
                "inline-block px-2.5 py-0.5 rounded-[6px] text-xs font-medium border",
                statusCfg.badgeClass
              )}
            >
              {statusCfg.label}
            </span>
          </div>
          <p className="text-xs text-[#635850] mt-1.5">
            Placed on{" "}
            {new Date(order.createdAt).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            ,{" "}
            {new Date(order.createdAt).toLocaleTimeString("en-IN", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: true,
            })}
          </p>
        </div>

        {/* Header Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] border border-[#E8DFD4] text-[#1A1614] bg-white hover:bg-[#FAF5EF] transition-colors shadow-2xs"
            title="Print Delivery Address Slip"
          >
            <Printer className="w-3.5 h-3.5 text-[#BF5330]" />
            <span>Print Address</span>
          </button>

          {nextForwardStatus && (
            <button
              type="button"
              onClick={() => openStatusTransition(nextForwardStatus)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-[8px] bg-[#BF5330] text-white hover:bg-[#8F3E20] transition-colors shadow-2xs"
            >
              <span>Move to {STATUS_CONFIG[nextForwardStatus]?.label || nextForwardStatus}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isCancellable && (
            <button
              type="button"
              onClick={() => openStatusTransition("cancelled")}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-[8px] border border-[#F0C4B8] text-[#BF5330] bg-white hover:bg-[#FDF4ED] transition-colors shadow-2xs"
            >
              <Clock className="w-3.5 h-3.5 text-[#BF5330]" />
              <span>Cancel Order</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Notification */}
      {actionSuccess && (
        <div className="p-3.5 rounded-[8px] bg-[#ECFDF3] border border-[#A6F4C5] text-[#027A48] text-xs font-medium flex items-center justify-between">
          <span>{actionSuccess}</span>
          <button
            type="button"
            onClick={() => setActionSuccess(null)}
            className="text-[#027A48] hover:text-[#054F31] text-base leading-none"
          >
            &times;
          </button>
        </div>
      )}

      {/* Attention Flag Banner */}
      {order.attentionReason && (
        <div className="p-4 rounded-[8px] bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs">
          <div className="flex items-center gap-2 font-bold mb-1">
            <AlertCircle className="w-4 h-4 text-[#B42318]" />
            <span>Action Required: {order.attentionReason}</span>
          </div>
          <p className="text-[11px] text-[#912018]">
            This order is flagged for manual administrative review or refund resolution.
          </p>
        </div>
      )}

      {/* ── Main Two-Column Layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── Left Column (Approx. 65% width) ───────────────────────────────── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          {/* A. Ordered Items Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-[#E8DFD4]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                  Ordered Items ({order.items.length})
                </h2>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-[#BF5330] font-medium">
                <History className="w-3.5 h-3.5" />
                <span>Historical snapshot prices</span>
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="border-b border-[#E8DFD4] text-[12px] font-medium text-[#635850]">
                    <th className="py-3 pr-4 font-medium">Product</th>
                    <th className="py-3 px-4 font-medium">Variant / SKU</th>
                    <th className="py-3 px-4 font-medium text-left">Price</th>
                    <th className="py-3 px-4 font-medium text-center">Quantity</th>
                    <th className="py-3 pl-4 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8DFD4]">
                  {order.items.map((item) => {
                    const productName = item.productName || item.title || "Product";
                    const unitPricePaise = item.unitPricePaise ?? item.pricePaise ?? 0;
                    const lineTotalPaise =
                      item.lineTotalPaise ??
                      item.totalPaise ??
                      unitPricePaise * (item.quantity || 1);
                    const imageSrc = getProductImage(productName);

                    return (
                      <tr key={item.id} className="text-sm">
                        <td className="py-4 pr-4">
                          <div className="flex items-center gap-3">
                            <div className="relative w-12 h-12 rounded-[6px] bg-[#FAF5EF] border border-[#E8DFD4] overflow-hidden shrink-0">
                              <Image
                                src={imageSrc}
                                alt={productName}
                                fill
                                sizes="48px"
                                className="object-cover"
                                onError={(e) => {
                                  (e.currentTarget as HTMLElement).style.display = "none";
                                }}
                              />
                              <div className="absolute inset-0 flex items-center justify-center text-[#BF5330]/40 -z-10">
                                <Package className="w-5 h-5" />
                              </div>
                            </div>
                            <span className="font-semibold text-[#1A1614] text-[13.5px] leading-snug">
                              {productName}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-xs text-[#635850]">
                          <div className="space-y-0.5">
                            <div>Size: {item.variantLabel || "Standard"}</div>
                            <div className="text-[#8A7E74] font-mono text-[11px]">
                              SKU: {item.sku || "N/A"}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm font-medium text-[#1A1614] whitespace-nowrap">
                          {safeFormatPrice(unitPricePaise)}
                        </td>
                        <td className="py-4 px-4 text-sm font-medium text-[#1A1614] text-center">
                          {item.quantity}
                        </td>
                        <td className="py-4 pl-4 text-sm font-semibold text-[#1A1614] text-right whitespace-nowrap">
                          {safeFormatPrice(lineTotalPaise)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Financial Summary */}
            <div className="pt-4 border-t border-[#E8DFD4] space-y-2.5 text-sm">
              <div className="flex justify-between items-center text-[#635850]">
                <span>
                  Items Subtotal ({totalQuantity} item{totalQuantity === 1 ? "" : "s"})
                </span>
                <span className="font-medium text-[#1A1614]">
                  {safeFormatPrice(subtotalPaise)}
                </span>
              </div>

              {discountPaise > 0 && (
                <div className="flex justify-between items-center text-[#027A48]">
                  <span className="flex items-center gap-1.5">
                    <span>Discount</span>
                    {order.couponCode && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                        {order.couponCode}
                      </span>
                    )}
                  </span>
                  <span className="font-medium">-{safeFormatPrice(discountPaise)}</span>
                </div>
              )}

              <div className="flex justify-between items-center text-[#635850]">
                <span>Shipping Charges</span>
                <span className="font-medium text-[#1A1614]">
                  {shippingPaise === 0 ? "—" : safeFormatPrice(shippingPaise)}
                </span>
              </div>

              <div className="flex justify-between items-center pt-3 border-t border-[#E8DFD4]">
                <span className="font-bold text-[#1A1614] text-base">Total Amount</span>
                <span className="font-bold text-[#BF5330] text-xl">
                  {safeFormatPrice(totalPaise)}
                </span>
              </div>
            </div>
          </div>

          {/* B. Payment Gateway Records Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                <CreditCard className="w-4 h-4" />
              </div>
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                Payment Gateway Records
              </h2>
            </div>

            {order.payments.length === 0 ? (
              <p className="text-xs text-[#635850]">
                No payment gateway records recorded for this order.
              </p>
            ) : (
              <div className="space-y-3">
                {order.payments.map((p) => {
                  const paymentAmount = p.amountPaise ?? totalPaise;
                  return (
                    <div
                      key={p.id}
                      className="p-4 rounded-[8px] border border-[#E8DFD4] bg-white flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs font-semibold text-[#1A1614]">
                            Payment ID
                          </span>
                          <span
                            className={cn(
                              "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border",
                              p.status === "captured"
                                ? "bg-[#ECFDF3] text-[#027A48] border-[#A6F4C5]"
                                : p.status === "refunded"
                                ? "bg-[#FEF6EE] text-[#C4320A] border-[#F9DBAF]"
                                : "bg-[#EFF8FF] text-[#175CD3] border-[#B2DDFF]"
                            )}
                          >
                            {p.status || "CREATED"}
                          </span>
                        </div>
                        <div className="text-xs text-[#635850]">
                          Method: {p.method || "Razorpay Online"} &bull;{" "}
                          {new Date(p.createdAt).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                          ,{" "}
                          {new Date(p.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                            hour12: true,
                          })}
                        </div>
                      </div>
                      <div className="font-bold text-base text-[#1A1614]">
                        {safeFormatPrice(paymentAmount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* C. Shipment & Courier Tracking Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                  <Truck className="w-4 h-4" />
                </div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                  Shipment &amp; Courier Tracking
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {order.shipments && order.shipments.length > 0 ? (
                  <>
                    <button
                      type="button"
                      disabled={syncingTracking}
                      onClick={handleSyncTracking}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] bg-[#FAF5EF] hover:bg-[#F4ECE1] border border-[#E8DFD4] text-[#1A1614] transition-colors disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn("w-3.5 h-3.5", syncingTracking && "animate-spin")}
                      />
                      <span>{syncingTracking ? "Syncing..." : "Refresh Tracking"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingShipment(!editingShipment)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-[6px] border border-[#BF5330] text-[#BF5330] hover:bg-[#FDF4ED] transition-colors"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>{editingShipment ? "Cancel" : "Edit Tracking"}</span>
                    </button>
                  </>
                ) : (
                  <>
                    {order.status !== "cancelled" && order.status !== "refunded" && (
                      <button
                        type="button"
                        disabled={creatingShipment}
                        onClick={() => handleCreateShipment("shiprocket")}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[6px] bg-[#BF5330] hover:bg-[#8F3E20] text-white transition-colors disabled:opacity-50 shadow-2xs"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>{creatingShipment ? "Creating..." : "Create Shipment"}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setEditingShipment(!editingShipment)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-[6px] border border-[#BF5330] text-[#BF5330] hover:bg-[#FDF4ED] transition-colors"
                    >
                      <span>{editingShipment ? "Cancel" : "Manual Dispatch"}</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {shipmentError && (
              <div className="mb-4 p-3 rounded-[8px] bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs">
                {shipmentError}
              </div>
            )}

            {editingShipment ? (
              <form onSubmit={handleSaveShipment} className="space-y-3.5 text-xs pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block font-medium text-[#1A1614] mb-1">
                      Courier Partner *
                    </label>
                    <input
                      type="text"
                      required
                      value={shipCourier}
                      onChange={(e) => setShipCourier(e.target.value)}
                      placeholder="e.g. India Post, Delhivery, BlueDart"
                      className="w-full px-3 py-2 rounded-[6px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] text-[#1A1614]"
                    />
                  </div>

                  <div>
                    <label className="block font-medium text-[#1A1614] mb-1">
                      AWB / Tracking Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={shipAwb}
                      onChange={(e) => setShipAwb(e.target.value)}
                      placeholder="e.g. IN123456789"
                      className="w-full px-3 py-2 rounded-[6px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] font-mono text-[#1A1614]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-[#1A1614] mb-1">
                    Tracking URL (Optional)
                  </label>
                  <input
                    type="url"
                    value={shipUrl}
                    onChange={(e) => setShipUrl(e.target.value)}
                    placeholder="https://track.courier.in/..."
                    className="w-full px-3 py-2 rounded-[6px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] font-mono text-[#1A1614]"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-[#E8DFD4]">
                  <button
                    type="button"
                    onClick={() => setEditingShipment(false)}
                    className="px-3 py-1.5 rounded-[6px] border border-[#E8DFD4] text-[#635850] hover:bg-[#FAF5EF]"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingShipment}
                    className="px-4 py-1.5 rounded-[6px] bg-[#BF5330] text-white font-semibold hover:bg-[#8F3E20] disabled:opacity-50"
                  >
                    {savingShipment ? "Saving..." : "Save Shipment"}
                  </button>
                </div>
              </form>
            ) : !order.shipments || order.shipments.length === 0 ? (
              <p className="text-xs text-[#635850] leading-relaxed">
                No tracking information recorded yet. Click &quot;Create Shipment&quot; or
                &quot;Manual Dispatch&quot; to assign courier details.
              </p>
            ) : (
              <div className="space-y-4 text-xs">
                {order.shipments.map((s) => (
                  <div
                    key={s.id}
                    className="p-4 rounded-[8px] border border-[#E8DFD4] bg-white space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-[#1A1614]">
                          {s.courierName || "Standard Shipping"}
                        </span>
                        {s.provider && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono uppercase bg-[#FAF5EF] text-[#635850] border border-[#E8DFD4]">
                            {s.provider}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-[#ECFDF3] text-[#027A48] border border-[#A6F4C5]">
                          {s.status}
                        </span>
                      </div>
                      <span className="font-mono text-xs font-bold text-[#BF5330]">
                        AWB: {s.awb}
                      </span>
                    </div>

                    {s.trackingUrl && (
                      <a
                        href={s.trackingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-[#BF5330] hover:underline inline-flex items-center gap-1 font-medium"
                      >
                        <span>Track package on courier portal</span>
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    )}

                    <div className="flex flex-wrap gap-4 text-[11px] text-[#635850] pt-2 border-t border-[#E8DFD4]/70">
                      {s.shippedAt && (
                        <span>
                          Dispatched:{" "}
                          {new Date(s.shippedAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      )}
                      {s.deliveredAt && (
                        <span>
                          Delivered:{" "}
                          {new Date(s.deliveredAt).toLocaleString("en-IN", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                            hour12: true,
                          })}
                        </span>
                      )}
                    </div>

                    {/* Tracking Events Timeline */}
                    {s.events && s.events.length > 0 && (
                      <div className="pt-2 border-t border-[#E8DFD4]/70">
                        <h4 className="font-semibold text-xs text-[#1A1614] mb-2">
                          Activity Log ({s.events.length})
                        </h4>
                        <div className="space-y-2 pl-3 border-l-2 border-[#E8DFD4] text-xs">
                          {s.events.map((ev: any, idx: number) => (
                            <div key={ev.id || idx} className="space-y-0.5">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-[#1A1614]">
                                  {ev.description || ev.status}
                                </span>
                                <span className="text-[10px] text-[#8A7E74]">
                                  {new Date(ev.occurredAt).toLocaleTimeString("en-IN", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                    hour12: true,
                                  })}
                                </span>
                              </div>
                              {ev.location && (
                                <span className="text-[11px] text-[#635850] block">
                                  {ev.location}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Right Column (Approx. 35% width) ──────────────────────────────── */}
        <div className="lg:col-span-5 xl:col-span-4 space-y-6">
          {/* 1. Order Status Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                <Clock className="w-4 h-4" />
              </div>
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                Order Status
              </h2>
            </div>

            <div className="space-y-2">
              <div>
                <span
                  className={cn(
                    "inline-block px-3 py-1 rounded-[6px] text-xs font-semibold border",
                    statusCfg.badgeClass
                  )}
                >
                  {statusCfg.label}
                </span>
              </div>
              <p className="text-xs text-[#635850] leading-relaxed">
                {statusCfg.description}
              </p>
            </div>
          </div>

          {/* 2. Customer Information Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs text-xs">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                <User className="w-4 h-4" />
              </div>
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                Customer Information
              </h2>
            </div>

            <div className="space-y-3">
              <div className="grid grid-cols-[70px_1fr] gap-2 items-center">
                <span className="text-[#635850]">Name</span>
                <span className="font-semibold text-[#1A1614]">
                  {order.customer.name || "Customer"}
                </span>
              </div>
              <div className="grid grid-cols-[70px_1fr] gap-2 items-center">
                <span className="text-[#635850]">Email</span>
                <a
                  href={`mailto:${order.customer.email}`}
                  className="text-[#BF5330] hover:underline font-medium break-all"
                >
                  {order.customer.email}
                </a>
              </div>
              <div className="grid grid-cols-[70px_1fr] gap-2 items-center">
                <span className="text-[#635850]">Phone</span>
                <span className="font-mono text-[#1A1614]">
                  {order.customer.phone || order.shippingAddress?.phone || "Not provided"}
                </span>
              </div>
            </div>
          </div>

          {/* 3. Delivery Address Snapshot Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs text-xs">
            <div className="flex items-center justify-between gap-2.5 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                  <MapPin className="w-4 h-4" />
                </div>
                <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                  Delivery Address Snapshot
                </h2>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-[6px] border border-[#E8DFD4] text-[#BF5330] hover:bg-[#FDF4ED] hover:border-[#F0C4B8] transition-colors"
                title="Print Address Slip"
              >
                <Printer className="w-3.5 h-3.5 text-[#BF5330]" />
                <span>Print</span>
              </button>
            </div>

            <div className="space-y-1.5 text-[#635850] leading-relaxed">
              <span className="font-bold text-sm text-[#1A1614] block">
                {order.shippingAddress?.fullName || order.customer.name || "Customer"}
              </span>
              {order.shippingAddress?.line1 && <p>{order.shippingAddress.line1}</p>}
              {order.shippingAddress?.line2 && <p>{order.shippingAddress.line2}</p>}
              <p>
                {[order.shippingAddress?.city, order.shippingAddress?.state]
                  .filter(Boolean)
                  .join(", ")}
                {pincode ? ` - ${pincode}` : ""}
              </p>
              {order.shippingAddress?.country && order.shippingAddress.country !== "India" && (
                <p>{order.shippingAddress.country}</p>
              )}
              <div className="pt-2 text-xs text-[#1A1614] font-medium font-mono">
                Phone: {order.shippingAddress?.phone || order.customer.phone || "Not provided"}
              </div>
            </div>
          </div>

          {/* 4. Order Audit Activity Card */}
          <div className="bg-white border border-[#E8DFD4] rounded-[10px] p-5 sm:p-6 shadow-xs text-xs">
            <div className="flex items-center gap-2.5 mb-3.5">
              <div className="w-8 h-8 rounded-lg bg-[#FAF5EF] flex items-center justify-center text-[#BF5330]">
                <History className="w-4 h-4" />
              </div>
              <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                Order Audit Activity
              </h2>
            </div>

            {order.activity.length === 0 ? (
              <p className="text-xs text-[#8A7E74] italic">
                No recorded admin mutations yet.
              </p>
            ) : (
              <div className="space-y-3">
                {order.activity.map((act) => (
                  <div
                    key={act.id}
                    className="pb-2.5 border-b border-[#E8DFD4]/60 last:border-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[#1A1614] capitalize">
                        {act.action.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-[#8A7E74]">
                        {new Date(act.createdAt).toLocaleDateString("en-IN", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    {act.actor?.email && (
                      <span className="text-[11px] text-[#635850] block mt-0.5">
                        by {act.actor.email}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Status Transition Modal ─────────────────────────────────────────── */}
      {statusModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E8DFD4] rounded-[12px] max-w-md w-full p-6 shadow-lg text-xs font-[family-name:var(--font-body)]">
            <div className="flex items-center justify-between pb-3 border-b border-[#E8DFD4] mb-4">
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#1A1614]">
                {targetStatus === "cancelled"
                  ? "Cancel Order"
                  : `Update Status to "${STATUS_CONFIG[targetStatus]?.label || targetStatus}"`}
              </h3>
              <button
                type="button"
                onClick={() => setStatusModalOpen(false)}
                className="text-[#635850] hover:text-[#1A1614] text-lg leading-none"
              >
                &times;
              </button>
            </div>

            {transitionError && (
              <div className="mb-4 p-3 rounded-[8px] bg-[#FEF3F2] border border-[#FECDCA] text-[#B42318] text-xs font-medium">
                {transitionError}
              </div>
            )}

            <form onSubmit={handleTransitionSubmit} className="space-y-4">
              {targetStatus === "cancelled" ? (
                <div>
                  <p className="text-[#B42318] font-medium mb-3 leading-relaxed">
                    Cancelling this order will release held variant inventory back to available
                    stock.
                  </p>
                  <label
                    htmlFor="cancel-reason"
                    className="block font-medium text-[#1A1614] mb-1"
                  >
                    Cancellation Reason (Required) *
                  </label>
                  <textarea
                    id="cancel-reason"
                    rows={3}
                    required
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                    placeholder="e.g. Customer requested cancellation before dispatch..."
                    className="w-full px-3 py-2 rounded-[8px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] text-xs text-[#1A1614]"
                  />
                </div>
              ) : targetStatus === "shipped" ? (
                <div className="space-y-3">
                  <p className="text-[#635850]">
                    Provide dispatch courier details to complete shipping transition.
                  </p>
                  <div>
                    <label
                      htmlFor="ship-courier"
                      className="block font-medium text-[#1A1614] mb-1"
                    >
                      Courier Partner *
                    </label>
                    <input
                      id="ship-courier"
                      type="text"
                      required
                      value={courierName}
                      onChange={(e) => setCourierName(e.target.value)}
                      placeholder="e.g. Delhivery, India Post"
                      className="w-full px-3 py-2 rounded-[6px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] text-xs text-[#1A1614]"
                    />
                  </div>
                  <div>
                    <label htmlFor="ship-awb" className="block font-medium text-[#1A1614] mb-1">
                      AWB / Tracking Number *
                    </label>
                    <input
                      id="ship-awb"
                      type="text"
                      required
                      value={awb}
                      onChange={(e) => setAwb(e.target.value)}
                      placeholder="e.g. 1234567890"
                      className="w-full px-3 py-2 rounded-[6px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] font-mono text-xs text-[#1A1614]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="ship-track-url"
                      className="block font-medium text-[#1A1614] mb-1"
                    >
                      Tracking Link (Optional)
                    </label>
                    <input
                      id="ship-track-url"
                      type="url"
                      value={trackingUrl}
                      onChange={(e) => setTrackingUrl(e.target.value)}
                      placeholder="https://track.courier.in/..."
                      className="w-full px-3 py-2 rounded-[6px] border border-[#E8DFD4] bg-[#FAF5EF]/60 focus:outline-none focus:border-[#BF5330] font-mono text-xs text-[#1A1614]"
                    />
                  </div>
                </div>
              ) : (
                <p className="text-[#635850] leading-relaxed">
                  Confirm transition of this order from{" "}
                  <strong>{statusCfg.label}</strong> to{" "}
                  <strong>{STATUS_CONFIG[targetStatus]?.label || targetStatus}</strong>.
                </p>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-[#E8DFD4]">
                <button
                  type="button"
                  onClick={() => setStatusModalOpen(false)}
                  disabled={transitioning}
                  className="px-3.5 py-1.5 rounded-[6px] border border-[#E8DFD4] text-[#635850] hover:bg-[#FAF5EF]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transitioning}
                  className={cn(
                    "px-4 py-1.5 rounded-[6px] font-semibold text-white transition-colors disabled:opacity-50",
                    targetStatus === "cancelled"
                      ? "bg-[#B42318] hover:bg-[#912018]"
                      : "bg-[#BF5330] hover:bg-[#8F3E20]"
                  )}
                >
                  {transitioning
                    ? "Updating..."
                    : targetStatus === "cancelled"
                    ? "Confirm Cancellation"
                    : "Update Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      </div>

      {/* ── Dedicated Print-Only Shipping Address Slip ─────────────────────── */}
      <div
        id="admin-address-slip-wrapper"
        className="hidden print:block print:w-full print:m-0 print:p-0 text-black bg-white"
      >
        <div
          className="w-[520px] max-w-full mx-auto bg-white border-2 border-black rounded-[6px] p-5 space-y-0 text-black box-border"
          style={{ fontFamily: 'var(--font-inter), "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
        >
          {/* ── 1. Header Section ── */}
          <div className="flex items-start justify-between pb-3">
            <div>
              <h1
                className="text-[18px] font-[800] tracking-tight text-black uppercase leading-tight m-0"
                style={{ fontFamily: 'var(--font-inter), "Inter", sans-serif', fontWeight: 800 }}
              >
                {businessSettings.businessName || "SPN HEALTH MIX"}
              </h1>
              <p className="text-[11.5px] font-medium text-black mt-0.5 m-0 leading-tight">
                Delivery Address Slip
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#374151] block leading-tight">
                ORDER ID
              </span>
              <span className="text-[13px] font-bold text-black mt-0.5 block leading-tight">
                {order.orderNumber}
              </span>
            </div>
          </div>

          {/* Solid black divider underneath header */}
          <div className="border-t-2 border-black w-full" />

          {/* ── 2. Delivery Address Section (DELIVER TO) ── */}
          <div className="pt-3.5 pb-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-black block leading-none mb-1">
                DELIVER TO:
              </span>
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#4B5563]">
                Order Date: {new Date(order.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
            <div
              className="text-[16.5px] font-bold text-black leading-snug"
              style={{ fontFamily: 'var(--font-pt-serif), "PT Serif", Georgia, serif' }}
            >
              {order.shippingAddress?.fullName || order.customer.name || "Customer"}
            </div>
            {order.shippingAddress?.line1 && (
              <div className="text-[13px] font-normal text-black leading-tight">
                {order.shippingAddress.line1}
              </div>
            )}
            {order.shippingAddress?.line2 && (
              <div className="text-[13px] font-normal text-black leading-tight">
                {order.shippingAddress.line2}
              </div>
            )}
            {order.shippingAddress?.landmark && (
              <div className="text-[12.5px] font-normal text-black leading-tight italic">
                Landmark: {order.shippingAddress.landmark}
              </div>
            )}
            <div className="text-[14px] font-bold text-black leading-tight pt-0.5">
              {[order.shippingAddress?.city, order.shippingAddress?.state]
                .filter(Boolean)
                .join(", ")}
              {pincode ? ` - ${pincode}` : ""}
            </div>
            {order.shippingAddress?.country && order.shippingAddress.country !== "India" && (
              <div className="text-[12px] font-normal text-black leading-tight">
                {order.shippingAddress.country}
              </div>
            )}

            {/* Customer Phone & Email */}
            <div className="pt-2 flex items-center gap-4 text-[12.5px]">
              <div>
                <span className="text-[10px] font-bold uppercase text-[#4B5563] block">CUSTOMER PHONE / MOBILE:</span>
                <span className="text-[13px] font-bold text-black tracking-wide">
                  {order.shippingAddress?.phone || order.customer.phone || "Not provided"}
                </span>
              </div>
              {order.customer.email && (
                <div className="border-l border-[#9CA3AF] pl-4">
                  <span className="text-[10px] font-bold uppercase text-[#4B5563] block">CUSTOMER EMAIL:</span>
                  <span className="text-[11.5px] font-medium text-black">
                    {order.customer.email}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Thin light-gray dashed divider */}
          <div className="border-t border-dashed border-[#9CA3AF] w-full" />

          {/* ── 3. From / Company Address & Phone Number Section ── */}
          <div className="py-3">
            <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#374151] block leading-none mb-1">
              FROM (SENDER / RETURN ADDRESS):
            </span>
            <div className="text-[13px] font-bold text-black leading-tight">
              {businessSettings.businessName || "SPN Health Mix"}
            </div>
            <div className="text-[12px] font-normal text-black leading-tight mt-1">
              {[
                businessSettings.address?.line1,
                businessSettings.address?.line2,
                businessSettings.address?.city,
                businessSettings.address?.state,
              ]
                .filter(Boolean)
                .join(", ")}
              {businessSettings.address?.pincode ? ` - ${businessSettings.address.pincode}` : ""}
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-black mt-1.5 font-medium">
              {businessSettings.phone && (
                <div>
                  <span className="font-bold">Phone:</span> {businessSettings.phone}
                </div>
              )}
              {businessSettings.supportEmail && (
                <div>
                  <span className="font-bold">Email:</span> {businessSettings.supportEmail}
                </div>
              )}
              {businessSettings.fssaiNumber && (
                <div>
                  <span className="font-bold">FSSAI:</span> {businessSettings.fssaiNumber}
                </div>
              )}
            </div>
          </div>

          {/* Solid divider */}
          <div className="border-t border-black w-full" />

          {/* ── 4. Footer Section ── */}
          <div className="pt-2.5 flex items-center justify-between text-[10.5px] font-normal text-black">
            <div>
              Total Items: <span className="font-bold">{totalQuantity} {totalQuantity === 1 ? "item" : "items"}</span>
            </div>
            <div>
              Order Status: <span className="font-bold uppercase">{order.status.replace(/_/g, " ")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

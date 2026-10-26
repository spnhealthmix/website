export type TransactionalEmailEventType =
  | "ORDER_CONFIRMED"
  | "PAYMENT_SUCCESS"
  | "PAYMENT_FAILED"
  | "ORDER_PROCESSING"
  | "ORDER_PACKED"
  | "ORDER_SHIPPED"
  | "ORDER_OUT_FOR_DELIVERY"
  | "ORDER_DELIVERED"
  | "ORDER_CANCELLED"
  | "REFUND_PROCESSED";

export interface EmailRecipient {
  email: string;
  name?: string | null;
}

export interface EmailMessage {
  to: EmailRecipient;
  from?: string;
  replyTo?: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface EmailOrderItem {
  productName: string;
  variantLabel: string;
  quantity: number;
  unitPricePaise: number;
  lineTotalPaise: number;
  productSlug?: string | null;
}

export interface EmailAddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string | null;
  landmark?: string | null;
  city: string;
  state: string;
  pincode: string;
}

export interface BaseOrderEmailData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  createdAt: Date;
  items: EmailOrderItem[];
  subtotalPaise: number;
  discountPaise: number;
  shippingPaise: number;
  totalPaise: number;
  shippingAddress: EmailAddressSnapshot;
  orderUrl: string;
}

export interface OrderConfirmedData extends BaseOrderEmailData {
  paymentMethod?: string | null;
}

export interface PaymentSuccessData extends BaseOrderEmailData {
  razorpayPaymentId: string;
  amountPaise: number;
  paidAt: Date;
  paymentMethod?: string | null;
}

export interface PaymentFailedData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  amountPaise: number;
  failedReason?: string | null;
  retryUrl: string;
  failedAttemptId?: string | null;
}

export interface OrderStatusUpdateData extends BaseOrderEmailData {
  status: "processing" | "packed";
}

export interface OrderShippedData extends BaseOrderEmailData {
  courierName: string;
  awb: string;
  trackingUrl?: string | null;
  shippedAt?: Date | null;
}

export interface OrderOutForDeliveryData extends BaseOrderEmailData {
  courierName?: string | null;
  awb?: string | null;
  location?: string | null;
  trackingUrl?: string | null;
}

export interface OrderDeliveredData extends BaseOrderEmailData {
  deliveredAt: Date;
  reviewUrl: string;
}

export interface OrderCancelledData extends BaseOrderEmailData {
  cancelledAt: Date;
  cancelReason?: string | null;
  refundPending: boolean;
}

export interface RefundProcessedData extends BaseOrderEmailData {
  refundAmountPaise: number;
  refundedAt: Date;
  razorpayPaymentId?: string | null;
}

export type EmailEventPayload =
  | { event: "ORDER_CONFIRMED"; data: OrderConfirmedData }
  | { event: "PAYMENT_SUCCESS"; data: PaymentSuccessData }
  | { event: "PAYMENT_FAILED"; data: PaymentFailedData }
  | { event: "ORDER_PROCESSING"; data: OrderStatusUpdateData }
  | { event: "ORDER_PACKED"; data: OrderStatusUpdateData }
  | { event: "ORDER_SHIPPED"; data: OrderShippedData }
  | { event: "ORDER_OUT_FOR_DELIVERY"; data: OrderOutForDeliveryData }
  | { event: "ORDER_DELIVERED"; data: OrderDeliveredData }
  | { event: "ORDER_CANCELLED"; data: OrderCancelledData }
  | { event: "REFUND_PROCESSED"; data: RefundProcessedData };

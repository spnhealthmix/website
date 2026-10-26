import type { AddressSnapshot, shipmentStatus } from "../db/schema";

export type NormalizedShipmentStatus = (typeof shipmentStatus.enumValues)[number];

export type ServiceabilityCheck = {
  serviceable: boolean;
  courierName?: string;
  estimatedDays?: number;
  city?: string;
  state?: string;
  message?: string;
};

export type ShippingRateQuote = {
  serviceable: boolean;
  ratePaise: number;
  courierName?: string;
  estimatedDays?: number;
  freeShipping?: boolean;
  message?: string;
};

export type ShipmentItemSnapshot = {
  productName: string;
  variantLabel: string;
  sku: string;
  quantity: number;
  unitPricePaise: number;
  weightGrams?: number | null;
};

export type CreateShipmentInput = {
  orderId: string;
  orderNumber: string;
  shippingAddress: AddressSnapshot;
  items: ShipmentItemSnapshot[];
  subtotalPaise: number;
  totalPaise: number;
  totalWeightGrams: number;
  courierName?: string;
  awb?: string;
  trackingUrl?: string;
};

export type CreateShipmentResult = {
  provider: string;
  externalShipmentId?: string;
  courierName: string;
  awb: string;
  trackingUrl?: string | null;
  status: NormalizedShipmentStatus;
};

export type NormalizedTrackingEvent = {
  status: NormalizedShipmentStatus;
  description: string;
  location?: string | null;
  occurredAt: Date;
};

export type TrackingResult = {
  status: NormalizedShipmentStatus;
  courierName?: string;
  awb: string;
  trackingUrl?: string | null;
  events: NormalizedTrackingEvent[];
  deliveredAt?: Date | null;
};

export type CancelShipmentResult = {
  success: boolean;
  message?: string;
};

export type WebhookEventResult = {
  eventId: string;
  provider: string;
  externalShipmentId?: string;
  awb?: string;
  orderNumber?: string;
  status: NormalizedShipmentStatus;
  event: NormalizedTrackingEvent;
};

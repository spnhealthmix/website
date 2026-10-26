import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import * as s from "../src/lib/db/schema";
import { applyCapturedPayment } from "../src/lib/orders/capture-payment";
import { expirePendingOrders } from "../src/lib/orders/expiry";
import { checkTransition } from "../src/lib/admin/orders";
import {
  acall, addAddress, call, checkout, db, fillCart, makeAdmin, profileIdOf, stockOf, useHarness, variant2Id, variantId,
} from "./harness";

useHarness();

const SOME = "11111111-1111-4111-8111-111111111111";
const SHIPMENT = { courierName: "DTDC", awb: "D1234567890", trackingUrl: "https://track.example.com/D1234567890" };

/** A customer order that has been paid and confirmed (2 x variant A by default). */
async function paidOrder(user: string, items?: { variantId: string; quantity: number }[]) {
  const addr = await addAddress(user);
  const co = (await checkout(user, addr.id, items ? { items } : {})).body;
  await applyCapturedPayment(db, { razorpayOrderId: co.razorpayOrderId, razorpayPaymentId: `pay_${co.razorpayOrderId}`, amountPaise: co.amountPaise });
  return { ...co, paymentId: `pay_${co.razorpayOrderId}` } as { orderId: string; orderNumber: string; razorpayOrderId: string; amountPaise: number; paymentId: string };
}
async function pendingOrder(user: string, items?: { variantId: string; quantity: number }[]) {
  const addr = await addAddress(user);
  return (await checkout(user, addr.id, items ? { items } : {})).body as { orderId: string; orderNumber: string; razorpayOrderId: string; amountPaise: number };
}
const orderRow = async (id: string) => (await db.select().from(s.orders).where(eq(s.orders.id, id)))[0];
const paymentRow = async (orderId: string) => (await db.select().from(s.payments).where(eq(s.payments.orderId, orderId)))[0];
const audit = async (action?: string) => (await db.select().from(s.adminAuditLog)).filter((a) => !action || a.action === action);
const setStatus = (id: string, body: object, user = "boss") => acall("POST", `/api/admin/orders/${id}/status`, { user, body });

/* -------------------------------------------------------------------------- */

describe("admin access control", () => {
  const endpoints: [string, string, unknown?][] = [
    ["GET", "/api/admin/dashboard"],
    ["GET", "/api/admin/orders"],
    ["GET", `/api/admin/orders/${SOME}`],
    ["POST", `/api/admin/orders/${SOME}/status`, { to: "processing" }],
    ["PATCH", `/api/admin/orders/${SOME}/note`, { note: "x" }],
    ["PATCH", `/api/admin/orders/${SOME}/shipment`, { awb: "ABC123" }],
    ["POST", `/api/admin/orders/${SOME}/refund/resolve`, { reference: "rfnd_1", amountPaise: 100 }],
    ["GET", "/api/admin/refunds"],
  ];

  it.each(endpoints)("signed out: %s %s -> 401", async (method, path, body) => {
    const r = await acall(method, path, { body });
    expect(r.status).toBe(401);
    expect(r.body.error.code).toBe("UNAUTHENTICATED");
  });

  it.each(endpoints)("signed-in customer (not admin): %s %s -> 403", async (method, path, body) => {
    const r = await acall(method, path, { user: "alice", body });
    expect(r.status).toBe(403);
    expect(r.body.error.code).toBe("FORBIDDEN");
  });

  it("a customer cannot read or change anyone's order through the admin API", async () => {
    const o = await paidOrder("alice");
    expect((await acall("GET", `/api/admin/orders/${o.orderId}`, { user: "alice" })).status).toBe(403);
    expect((await setStatus(o.orderId, { to: "processing" }, "alice")).status).toBe(403);
    expect((await orderRow(o.orderId)).status).toBe("confirmed");
    expect(await audit()).toHaveLength(0);
  });

  it("an admin is recognised from the database on every request: demote -> 403, delete account -> 401", async () => {
    await makeAdmin("boss");
    expect((await acall("GET", "/api/admin/dashboard", { user: "boss" })).status).toBe(200);
    await db.update(s.profiles).set({ role: "customer" }).where(eq(s.profiles.clerkUserId, "boss"));
    expect((await acall("GET", "/api/admin/dashboard", { user: "boss" })).status).toBe(403);
    await db.update(s.profiles).set({ role: "admin", deletedAt: new Date() }).where(eq(s.profiles.clerkUserId, "boss"));
    expect((await acall("GET", "/api/admin/dashboard", { user: "boss" })).status).toBe(401);
  });

  it("an admin sending admin-looking fields in a body gains nothing for others (role isn't settable anywhere)", async () => {
    await makeAdmin("boss");
    const r = await call("PATCH", "/api/me", { user: "alice", body: { role: "admin" } });
    expect(r.status).toBe(422);
    expect((await acall("GET", "/api/admin/dashboard", { user: "alice" })).status).toBe(403);
  });

  it("state-changing admin calls must come from our own site: missing or foreign Origin -> 403", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    expect((await acall("POST", `/api/admin/orders/${o.orderId}/status`, { user: "boss", body: { to: "processing" }, origin: null })).status).toBe(403);
    expect((await acall("POST", `/api/admin/orders/${o.orderId}/status`, { user: "boss", body: { to: "processing" }, origin: "https://evil.example" })).status).toBe(403);
    expect((await orderRow(o.orderId)).status).toBe("confirmed");
    expect((await setStatus(o.orderId, { to: "processing" })).status).toBe(200);
  });
});

describe("dashboard", () => {
  it("counts orders by status, the refund queue, 30-day revenue and low stock", async () => {
    await makeAdmin("boss");
    const a = await paidOrder("alice"); // confirmed, 30000
    const b = await paidOrder("bob", [{ variantId: variant2Id, quantity: 1 }]); // confirmed, 30000
    await setStatus(b.orderId, { to: "processing" });
    await pendingOrder("carol");
    await db.update(s.productVariants).set({ stock: 2 }).where(eq(s.productVariants.id, variantId));
    await db.update(s.orders).set({ attentionReason: "late_payment_no_stock", attentionAt: new Date() }).where(eq(s.orders.id, a.orderId));

    const r = await acall("GET", "/api/admin/dashboard", { user: "boss" });
    expect(r.status).toBe(200);
    expect(r.body.ordersByStatus).toEqual({ confirmed: 1, processing: 1, pending_payment: 1 });
    expect(r.body.toFulfil).toBe(2);
    expect(r.body.openRefunds).toBe(1);
    expect(r.body.last30Days).toEqual({ paidOrders: 2, revenuePaise: a.amountPaise + b.amountPaise });
    expect(r.body.lowStockVariants).toBe(1);
  });
});

describe("order list: filters, search, pagination", () => {
  async function seed() {
    await makeAdmin("boss");
    await call("PATCH", "/api/me", { user: "alice", body: { name: "Alice Kumar" } });
    const o1 = await paidOrder("alice");
    const o2 = await paidOrder("bob");
    const o3 = await pendingOrder("carol");
    await db.update(s.profiles).set({ name: "Bobby Singh" }).where(eq(s.profiles.clerkUserId, "bob"));
    return { o1, o2, o3 };
  }

  it("shows every customer's orders, newest first, with customer and item summary", async () => {
    const { o1, o2, o3 } = await seed();
    const r = await acall("GET", "/api/admin/orders", { user: "boss" });
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(3);
    expect(r.body.orders.map((o: any) => o.id)).toEqual([o3.orderId, o2.orderId, o1.orderId]);
    expect(r.body.orders[2]).toMatchObject({ orderNumber: o1.orderNumber, status: "confirmed", totalPaise: o1.amountPaise, itemCount: 2, needsAttention: false, customer: { email: "alice@example.com" } });
  });

  it("filters by status", async () => {
    const { o3 } = await seed();
    const r = await acall("GET", "/api/admin/orders?status=pending_payment", { user: "boss" });
    expect(r.body.orders.map((o: any) => o.id)).toEqual([o3.orderId]);
    expect((await acall("GET", "/api/admin/orders?status=bogus", { user: "boss" })).status).toBe(422);
  });

  it("searches by order number (any case, partial), customer email, customer name, and ship-to details", async () => {
    const { o1, o2 } = await seed();
    const ids = async (q: string) => (await acall("GET", `/api/admin/orders?q=${encodeURIComponent(q)}`, { user: "boss" })).body.orders.map((o: any) => o.id);
    expect(await ids(o1.orderNumber.toLowerCase())).toEqual([o1.orderId]);
    expect(await ids(o2.orderNumber.slice(0, 11))).toContain(o2.orderId);
    expect(await ids("bob@example")).toEqual([o2.orderId]);
    expect(await ids("alice kumar")).toEqual([o1.orderId]);
    expect(await ids("bobby")).toEqual([o2.orderId]);
    expect(await ids("Asha Raman")).toHaveLength(3); // ship-to name on all three
    expect(await ids("9876543210")).toHaveLength(3); // ship-to phone
    expect(await ids("+91 98765 43210")).toHaveLength(3);
    expect(await ids("nobody-here")).toEqual([]);
  });

  it("search text can't act as a wildcard", async () => {
    await seed();
    for (const q of ["%", "_", "\\", "%%", "a%b"]) {
      const r = await acall("GET", `/api/admin/orders?q=${encodeURIComponent(q)}`, { user: "boss" });
      expect(r.status).toBe(200);
      expect(r.body.orders).toEqual([]);
    }
  });

  it("filters by date range (bare date as upper bound includes that whole day)", async () => {
    const { o1, o2, o3 } = await seed();
    await db.update(s.orders).set({ createdAt: new Date("2026-09-01T10:00:00Z") }).where(eq(s.orders.id, o1.orderId));
    await db.update(s.orders).set({ createdAt: new Date("2026-09-15T23:30:00Z") }).where(eq(s.orders.id, o2.orderId));
    await db.update(s.orders).set({ createdAt: new Date("2026-10-02T09:00:00Z") }).where(eq(s.orders.id, o3.orderId));
    const ids = async (qs: string) => (await acall("GET", `/api/admin/orders?${qs}`, { user: "boss" })).body.orders.map((o: any) => o.id).sort();
    expect(await ids("from=2026-09-10&to=2026-09-15")).toEqual([o2.orderId]); // 15th 23:30 is within "to=2026-09-15"
    expect(await ids("from=2026-09-16")).toEqual([o3.orderId]);
    expect(await ids("to=2026-09-01")).toEqual([o1.orderId]);
    expect((await acall("GET", "/api/admin/orders?from=not-a-date", { user: "boss" })).status).toBe(422);
  });

  it("filters to orders needing attention", async () => {
    const { o2 } = await seed();
    await db.update(s.orders).set({ attentionReason: "payment_amount_mismatch", attentionAt: new Date() }).where(eq(s.orders.id, o2.orderId));
    const r = await acall("GET", "/api/admin/orders?attention=1", { user: "boss" });
    expect(r.body.orders.map((o: any) => o.id)).toEqual([o2.orderId]);
    expect(r.body.orders[0].needsAttention).toBe(true);
  });

  it("paginates with a stable total, and clamps silly limits", async () => {
    await seed();
    const p1 = await acall("GET", "/api/admin/orders?limit=2&offset=0", { user: "boss" });
    const p2 = await acall("GET", "/api/admin/orders?limit=2&offset=2", { user: "boss" });
    expect([p1.body.orders.length, p2.body.orders.length, p1.body.total, p2.body.total]).toEqual([2, 1, 3, 3]);
    expect(new Set([...p1.body.orders, ...p2.body.orders].map((o: any) => o.id)).size).toBe(3);
    expect((await acall("GET", "/api/admin/orders?limit=100000", { user: "boss" })).status).toBe(422);
    expect((await acall("GET", "/api/admin/orders?limit=0", { user: "boss" })).status).toBe(422);
  });
});

describe("order detail", () => {
  it("returns everything an admin needs, including internal fields customers never see", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    await db.update(s.orders).set({ adminNote: "call before delivery" }).where(eq(s.orders.id, o.orderId));
    const r = await acall("GET", `/api/admin/orders/${o.orderId}`, { user: "boss" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      id: o.orderId, status: "confirmed", adminNote: "call before delivery", totalPaise: o.amountPaise,
      customer: { email: "alice@example.com" },
      shippingAddress: { city: "Chennai", pincode: "600017" },
    });
    expect(r.body.items).toHaveLength(1);
    expect(r.body.payments[0]).toMatchObject({ status: "captured", razorpayPaymentId: o.paymentId, amountPaise: o.amountPaise });
    expect(r.body.shipments).toEqual([]);
    expect(r.body.activity).toEqual([]);
  });

  it("404 for unknown or malformed ids", async () => {
    await makeAdmin("boss");
    expect((await acall("GET", `/api/admin/orders/${SOME}`, { user: "boss" })).status).toBe(404);
    expect((await acall("GET", "/api/admin/orders/not-a-uuid", { user: "boss" })).status).toBe(404);
  });
});

describe("status transitions", () => {
  it("pure rules: forward only, delivered only from shipped, cancel only before shipping", () => {
    const ok = (f: any, t: string) => expect(() => checkTransition(f, t)).not.toThrow();
    const no = (f: any, t: string) => expect(() => checkTransition(f, t)).toThrow();
    ok("confirmed", "processing"); ok("confirmed", "packed"); ok("processing", "packed"); ok("packed", "shipped"); ok("shipped", "delivered");
    ok("pending_payment", "cancelled"); ok("confirmed", "cancelled"); ok("processing", "cancelled"); ok("packed", "cancelled");
    no("pending_payment", "processing"); no("pending_payment", "shipped"); no("confirmed", "confirmed"); no("packed", "processing");
    no("confirmed", "delivered"); no("packed", "delivered"); no("shipped", "cancelled"); no("shipped", "packed");
    no("delivered", "cancelled"); no("delivered", "shipped"); no("cancelled", "processing"); no("cancelled", "cancelled"); no("refunded", "cancelled");
  });

  it("walks an order through the whole lifecycle, and the customer sees each step", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    const customerStatus = async () => (await call("GET", `/api/me/orders/${o.orderId}`, { user: "alice" })).body;

    expect((await setStatus(o.orderId, { to: "processing" })).body.status).toBe("processing");
    expect((await customerStatus()).status).toBe("processing");
    expect((await setStatus(o.orderId, { to: "packed", note: "double boxed" })).body.status).toBe("packed");

    const shipped = await setStatus(o.orderId, { to: "shipped", shipment: SHIPMENT });
    expect(shipped.status).toBe(200);
    expect(shipped.body.status).toBe("shipped");
    expect(shipped.body.shipments[0]).toMatchObject({ provider: "manual", courierName: "DTDC", awb: "D1234567890", status: "in_transit" });
    expect(shipped.body.shipments[0].events).toHaveLength(1);
    const seen = await customerStatus();
    expect(seen.status).toBe("shipped");
    expect(seen.shipments[0]).toMatchObject({ courierName: "DTDC", awb: "D1234567890", trackingUrl: SHIPMENT.trackingUrl });

    const delivered = await setStatus(o.orderId, { to: "delivered" });
    expect(delivered.body.status).toBe("delivered");
    expect(delivered.body.shipments[0]).toMatchObject({ status: "delivered" });
    expect(delivered.body.shipments[0].deliveredAt).not.toBeNull();
    expect(delivered.body.shipments[0].events.map((e: any) => e.status)).toEqual(["in_transit", "delivered"]);
    expect((await customerStatus()).status).toBe("delivered");
    expect(await stockOf()).toBe(8); // fulfilment never touches stock
  });

  it("forward steps may be skipped, but never reversed or repeated", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    expect((await setStatus(o.orderId, { to: "packed" })).status).toBe(200); // confirmed -> packed
    for (const to of ["processing", "packed"]) {
      const r = await setStatus(o.orderId, { to });
      expect(r.status).toBe(409);
      expect(r.body.error.code).toBe("INVALID_TRANSITION");
    }
    expect((await orderRow(o.orderId)).status).toBe("packed");
  });

  it("an unpaid order can only be cancelled: it can't be fulfilled", async () => {
    await makeAdmin("boss");
    const o = await pendingOrder("alice");
    for (const to of ["processing", "packed"]) expect((await setStatus(o.orderId, { to })).status).toBe(409);
    expect((await setStatus(o.orderId, { to: "shipped", shipment: SHIPMENT })).status).toBe(409);
    expect((await orderRow(o.orderId)).status).toBe("pending_payment");
  });

  it("shipping needs courier and tracking number; delivering needs shipped first", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    await setStatus(o.orderId, { to: "packed" });
    expect((await setStatus(o.orderId, { to: "delivered" })).status).toBe(409);
    expect((await setStatus(o.orderId, { to: "shipped" })).body.error.code).toBe("SHIPMENT_REQUIRED");
    for (const shipment of [{ courierName: "D", awb: "D1234567890" }, { courierName: "DTDC", awb: "x" }, { courierName: "DTDC", awb: "bad<script>" }, { courierName: "DTDC", awb: "D1234567890", trackingUrl: "javascript:alert(1)" }, { courierName: "DTDC", awb: "D1234567890", trackingUrl: "http://insecure.example.com" }, { courierName: "DTDC", awb: "D1234567890", extra: 1 }]) {
      expect((await setStatus(o.orderId, { to: "shipped", shipment })).status).toBe(422);
    }
    expect((await orderRow(o.orderId)).status).toBe("packed");
    expect(await db.select().from(s.shipments)).toHaveLength(0);
  });

  it("rejects unknown target statuses and extra fields", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    for (const body of [{ to: "refunded" }, { to: "pending_payment" }, { to: "confirmed" }, { to: "bogus" }, {}, { to: "processing", status: "x" }]) {
      const res = await setStatus(o.orderId, body);
      expect(res.status).toBe(422);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.fields).toBeDefined();
    }
    // Also explicitly test invalid legacy payload { status: "delivered" } and extra field cancelReason
    const legacyStatusRes = await setStatus(o.orderId, { status: "delivered" } as any);
    expect(legacyStatusRes.status).toBe(422);
    expect(legacyStatusRes.body.error.fields).toHaveProperty("to");

    const legacyCancelRes = await setStatus(o.orderId, { to: "cancelled", cancelReason: "out of stock" } as any);
    expect(legacyCancelRes.status).toBe(422);
    expect(legacyCancelRes.body.error.fields).toBeDefined();
    // In Zod .strict(), unrecognized keys at root level produce issue.path = [] -> fields["_"]
    expect(legacyCancelRes.body.error.fields["_"]).toContain("cancelReason");

    expect((await orderRow(o.orderId)).status).toBe("confirmed");
    expect((await setStatus(SOME, { to: "processing" })).status).toBe(404);
  });

  it("5 simultaneous identical status changes: exactly one applies, the rest are 409", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    const rs = await Promise.all(Array.from({ length: 5 }, () => setStatus(o.orderId, { to: "processing" })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await audit("order.status_changed")).toHaveLength(1);
  });

  it("two admins racing different moves can never leave the order in an impossible state", async () => {
    await makeAdmin("boss");
    await makeAdmin("boss2");
    const o = await paidOrder("alice");
    const rs = await Promise.all([
      setStatus(o.orderId, { to: "packed" }, "boss"),
      setStatus(o.orderId, { to: "processing" }, "boss2"),
      setStatus(o.orderId, { to: "cancelled", note: "customer asked" }, "boss"),
    ]);
    const final = (await orderRow(o.orderId)).status;
    expect(["packed", "cancelled", "processing"]).toContain(final);
    expect(rs.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    // every success was valid against the status it actually saw: audit chain is consistent
    const chain = (await audit("order.status_changed")).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).map((a: any) => [a.details.from, a.details.to]);
    let cur = "confirmed";
    for (const [from, to] of chain) {
      expect(from).toBe(cur);
      cur = to;
    }
    expect(cur).toBe(final);
  });
});

describe("cancelling orders", () => {
  it("cancelling an UNPAID order releases its stock exactly once, with no refund owed", async () => {
    await makeAdmin("boss");
    const o = await pendingOrder("alice");
    expect(await stockOf()).toBe(8);
    const r = await setStatus(o.orderId, { to: "cancelled", note: "customer called to cancel" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "cancelled", cancelReason: "admin_cancelled", stockReleased: true, attentionReason: null });
    expect(await stockOf()).toBe(10);
    expect((await setStatus(o.orderId, { to: "cancelled", note: "again" })).status).toBe(409);
    expect(await stockOf()).toBe(10);
    expect((await acall("GET", "/api/admin/refunds", { user: "boss" })).body.total).toBe(0);
  });

  it("cancelling a PAID order restores stock once and puts the customer's money in the refund queue", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice", [{ variantId, quantity: 2 }, { variantId: variant2Id, quantity: 3 }]);
    expect([await stockOf(), await stockOf(variant2Id)]).toEqual([8, 7]);

    const r = await setStatus(o.orderId, { to: "cancelled", note: "out of ingredients" });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "cancelled", stockReleased: true, attentionReason: "cancelled_by_admin_refund_due" });
    expect(r.body.payments[0].status).toBe("refund_required");
    expect([await stockOf(), await stockOf(variant2Id)]).toEqual([10, 10]);

    const q = await acall("GET", "/api/admin/refunds", { user: "boss" });
    expect(q.body.items).toHaveLength(1);
    expect(q.body.items[0]).toMatchObject({ orderId: o.orderId, kind: "admin_cancelled", razorpayPaymentId: o.paymentId, paidAmountPaise: o.amountPaise });
  });

  it("a reason is required to cancel", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    for (const body of [{ to: "cancelled" }, { to: "cancelled", note: "" }, { to: "cancelled", note: "   " }]) {
      const r = await setStatus(o.orderId, body);
      expect(r.status).toBe(422);
      expect(r.body.error.code).toBe("NOTE_REQUIRED");
    }
    expect((await orderRow(o.orderId)).status).toBe("confirmed");
    expect(await stockOf()).toBe(8);
  });

  it("shipped, delivered and already-cancelled orders can't be cancelled", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    await setStatus(o.orderId, { to: "shipped", shipment: SHIPMENT });
    expect((await setStatus(o.orderId, { to: "cancelled", note: "too late" })).status).toBe(409);
    await setStatus(o.orderId, { to: "delivered" });
    expect((await setStatus(o.orderId, { to: "cancelled", note: "too late" })).status).toBe(409);
    expect(await stockOf()).toBe(8);
  });

  it("6 simultaneous cancels of a paid order restore stock once and flag one refund", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    const rs = await Promise.all(Array.from({ length: 6 }, () => setStatus(o.orderId, { to: "cancelled", note: "duplicate click" })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(await stockOf()).toBe(10);
    expect(await audit("order.status_changed")).toHaveLength(1);
  });

  it("a customer who still pays an admin-cancelled unpaid order is caught by the refund queue, not lost", async () => {
    await makeAdmin("boss");
    const o = await pendingOrder("alice");
    await setStatus(o.orderId, { to: "cancelled", note: "stock problem" });
    const late = await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: "pay_late", amountPaise: o.amountPaise });
    expect(late.outcome).toBe("refund_required");
    const q = await acall("GET", "/api/admin/refunds", { user: "boss" });
    expect(q.body.items[0]).toMatchObject({ orderId: o.orderId, kind: "duplicate_payment", razorpayPaymentId: null });
    expect(q.body.items[0].reason).toContain("payment_on_non_pending_order");
    expect(await stockOf()).toBe(10); // not re-reserved: admin cancellation is final
  });
});

describe("admin notes and shipment corrections", () => {
  it("sets, changes and clears the internal note; customers never see it", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    const set = await acall("PATCH", `/api/admin/orders/${o.orderId}/note`, { user: "boss", body: { note: "  Leave with security\n\n\n\nguard  " } });
    expect(set.body.adminNote).toBe("Leave with security\n\nguard");
    expect((await call("GET", `/api/me/orders/${o.orderId}`, { user: "alice" })).body).not.toHaveProperty("adminNote");
    expect((await acall("PATCH", `/api/admin/orders/${o.orderId}/note`, { user: "boss", body: { note: null } })).body.adminNote).toBeNull();
    expect((await acall("PATCH", `/api/admin/orders/${o.orderId}/note`, { user: "boss", body: { note: "x".repeat(1001) } })).status).toBe(422);
    expect((await acall("PATCH", `/api/admin/orders/${o.orderId}/note`, { user: "boss", body: { note: "ok", extra: 1 } })).status).toBe(422);
    expect(await audit("order.note_changed")).toHaveLength(2);
  });

  it("corrects courier / tracking details only once shipped", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    const early = await acall("PATCH", `/api/admin/orders/${o.orderId}/shipment`, { user: "boss", body: { awb: "NEW123456" } });
    expect(early.status).toBe(409);
    expect(early.body.error.code).toBe("NOT_SHIPPED");

    await setStatus(o.orderId, { to: "shipped", shipment: SHIPMENT });
    const fixed = await acall("PATCH", `/api/admin/orders/${o.orderId}/shipment`, { user: "boss", body: { awb: "NEW123456", courierName: "Professional Couriers" } });
    expect(fixed.status).toBe(200);
    expect(fixed.body.shipments[0]).toMatchObject({ awb: "NEW123456", courierName: "Professional Couriers" });
    expect((await call("GET", `/api/me/orders/${o.orderId}`, { user: "alice" })).body.shipments[0].awb).toBe("NEW123456");
    expect((await acall("PATCH", `/api/admin/orders/${o.orderId}/shipment`, { user: "boss", body: { trackingUrl: "javascript:alert(1)" } })).status).toBe(422);
    expect((await acall("PATCH", `/api/admin/orders/${o.orderId}/shipment`, { user: "boss", body: {} })).status).toBe(422);
    const cleared = await acall("PATCH", `/api/admin/orders/${o.orderId}/shipment`, { user: "boss", body: { trackingUrl: null } });
    expect(cleared.body.shipments[0].trackingUrl).toBeNull();
  });
});

/* ------------------------------ Refund queue ------------------------------- */

describe("refund-required queue", () => {
  /** Paid after expiry with stock gone: the 'late payment' case. */
  async function lateNoStock(user: string) {
    const o = await pendingOrder(user);
    await db.update(s.orders).set({ expiresAt: new Date(Date.now() - 3600_000) }).where(eq(s.orders.id, o.orderId));
    await expirePendingOrders(db);
    await db.update(s.productVariants).set({ stock: 1 }).where(eq(s.productVariants.id, variantId));
    await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: `pay_${o.razorpayOrderId}`, amountPaise: o.amountPaise });
    return { ...o, paymentId: `pay_${o.razorpayOrderId}` };
  }

  it("lists all four kinds with what's needed to refund them in Razorpay, oldest first", async () => {
    await makeAdmin("boss");
    const late = await lateNoStock("alice");
    await db.update(s.productVariants).set({ stock: 50 }).where(eq(s.productVariants.id, variantId));

    const mismatch = await pendingOrder("bob");
    await applyCapturedPayment(db, { razorpayOrderId: mismatch.razorpayOrderId, razorpayPaymentId: "pay_mismatch", amountPaise: mismatch.amountPaise - 100 });

    const dup = await paidOrder("carol");
    await applyCapturedPayment(db, { razorpayOrderId: dup.razorpayOrderId, razorpayPaymentId: "pay_extra", amountPaise: dup.amountPaise });

    const cancelled = await paidOrder("dave");
    await setStatus(cancelled.orderId, { to: "cancelled", note: "supplier issue" });

    const r = await acall("GET", "/api/admin/refunds", { user: "boss" });
    expect(r.status).toBe(200);
    expect(r.body.total).toBe(4);
    const byOrder = Object.fromEntries(r.body.items.map((i: any) => [i.orderId, i]));
    expect(byOrder[late.orderId]).toMatchObject({ kind: "late_payment_no_stock", orderStatus: "cancelled", paymentStatus: "refund_required", razorpayPaymentId: late.paymentId, paidAmountPaise: late.amountPaise, customer: { email: "alice@example.com" } });
    expect(byOrder[mismatch.orderId]).toMatchObject({ kind: "payment_amount_mismatch", orderStatus: "pending_payment", razorpayPaymentId: "pay_mismatch", paidAmountPaise: mismatch.amountPaise });
    expect(byOrder[dup.orderId]).toMatchObject({ kind: "duplicate_payment", orderStatus: "confirmed", razorpayPaymentId: "pay_extra", paidAmountPaise: null });
    expect(byOrder[cancelled.orderId]).toMatchObject({ kind: "admin_cancelled", paymentStatus: "refund_required" });
    const times = r.body.items.map((i: any) => new Date(i.flaggedAt).getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("an empty queue is just empty; resolved orders leave the open list", async () => {
    await makeAdmin("boss");
    const r = await acall("GET", "/api/admin/refunds", { user: "boss" });
    expect(r.body).toEqual({ state: "open", total: 0, items: [] });
  });

  it("resolving a late-payment refund closes it: payment refunded, order refunded, flag cleared, audited", async () => {
    await makeAdmin("boss");
    const late = await lateNoStock("alice");
    const r = await acall("POST", `/api/admin/orders/${late.orderId}/refund/resolve`, { user: "boss", body: { reference: "rfnd_ABC123", amountPaise: late.amountPaise, note: "refunded in dashboard" } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "refunded", attentionReason: null, attentionAt: null });
    expect(r.body.payments[0].status).toBe("refunded");

    expect((await acall("GET", "/api/admin/refunds", { user: "boss" })).body.total).toBe(0);
    const done = await acall("GET", "/api/admin/refunds?state=resolved", { user: "boss" });
    expect(done.body.items).toHaveLength(1);
    expect(done.body.items[0]).toMatchObject({ orderId: late.orderId, resolvedBy: "boss@example.com" });
    expect(done.body.items[0].details).toMatchObject({ kind: "late_payment_no_stock", reference: "rfnd_ABC123", amountPaise: late.amountPaise, razorpayPaymentId: late.paymentId });
    expect(r.body.activity[0].action).toBe("refund.resolved");
  });

  it("resolving an admin-cancelled paid order moves it to refunded", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    await setStatus(o.orderId, { to: "cancelled", note: "supplier issue" });
    const r = await acall("POST", `/api/admin/orders/${o.orderId}/refund/resolve`, { user: "boss", body: { reference: "rfnd_1", amountPaise: o.amountPaise } });
    expect(r.body).toMatchObject({ status: "refunded", attentionReason: null });
    expect(await stockOf()).toBe(10); // stock was restored at cancellation, and only then
  });

  it("resolving an amount-mismatch on an unpaid order cancels it, releases its stock, and refunds", async () => {
    await makeAdmin("boss");
    const m = await pendingOrder("bob");
    expect(await stockOf()).toBe(8);
    await applyCapturedPayment(db, { razorpayOrderId: m.razorpayOrderId, razorpayPaymentId: "pay_m", amountPaise: m.amountPaise - 100 });
    const r = await acall("POST", `/api/admin/orders/${m.orderId}/refund/resolve`, { user: "boss", body: { reference: "rfnd_m", amountPaise: m.amountPaise } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "refunded", stockReleased: true });
    expect(await stockOf()).toBe(10);
  });

  it("resolving a duplicate payment leaves the real, fulfilled order alone", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("carol");
    await setStatus(o.orderId, { to: "processing" });
    await applyCapturedPayment(db, { razorpayOrderId: o.razorpayOrderId, razorpayPaymentId: "pay_extra", amountPaise: o.amountPaise });
    const r = await acall("POST", `/api/admin/orders/${o.orderId}/refund/resolve`, { user: "boss", body: { reference: "rfnd_dup", amountPaise: o.amountPaise } });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ status: "processing", attentionReason: null });
    expect(r.body.payments[0].status).toBe("captured"); // the legitimate payment is untouched
    expect(await stockOf()).toBe(8);
  });

  it("validates the resolution: reference required, amount positive and not above what was paid", async () => {
    await makeAdmin("boss");
    const late = await lateNoStock("alice");
    const url = `/api/admin/orders/${late.orderId}/refund/resolve`;
    for (const body of [{}, { amountPaise: 100 }, { reference: "rfnd_1" }, { reference: "ab", amountPaise: 100 }, { reference: "rfnd_1", amountPaise: 0 }, { reference: "rfnd_1", amountPaise: -5 }, { reference: "rfnd_1", amountPaise: 1.5 }, { reference: "rfnd_1", amountPaise: 100, status: "x" }]) {
      expect((await acall("POST", url, { user: "boss", body })).status).toBe(422);
    }
    const tooMuch = await acall("POST", url, { user: "boss", body: { reference: "rfnd_1", amountPaise: late.amountPaise + 1 } });
    expect(tooMuch.status).toBe(422);
    expect((await orderRow(late.orderId)).attentionReason).not.toBeNull(); // still open after every rejection
    // a partial refund is allowed and recorded
    expect((await acall("POST", url, { user: "boss", body: { reference: "rfnd_part", amountPaise: 5000 } })).status).toBe(200);
  });

  it("can't resolve what isn't flagged, or resolve twice", async () => {
    await makeAdmin("boss");
    const ok = await paidOrder("alice");
    const r1 = await acall("POST", `/api/admin/orders/${ok.orderId}/refund/resolve`, { user: "boss", body: { reference: "rfnd_1", amountPaise: 100 } });
    expect(r1.status).toBe(409);
    expect(r1.body.error.code).toBe("NOTHING_TO_RESOLVE");

    const late = await lateNoStock("bob");
    const url = `/api/admin/orders/${late.orderId}/refund/resolve`;
    expect((await acall("POST", url, { user: "boss", body: { reference: "rfnd_2", amountPaise: late.amountPaise } })).status).toBe(200);
    expect((await acall("POST", url, { user: "boss", body: { reference: "rfnd_2", amountPaise: late.amountPaise } })).status).toBe(409);
    expect((await acall("POST", `/api/admin/orders/${SOME}/refund/resolve`, { user: "boss", body: { reference: "rfnd_2", amountPaise: 100 } })).status).toBe(404);
  });

  it("5 simultaneous resolutions of one item: exactly one is recorded", async () => {
    await makeAdmin("boss");
    const late = await lateNoStock("alice");
    const rs = await Promise.all(Array.from({ length: 5 }, (_, i) => acall("POST", `/api/admin/orders/${late.orderId}/refund/resolve`, { user: "boss", body: { reference: `rfnd_${i}x`, amountPaise: late.amountPaise } })));
    expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
    expect(rs.filter((r) => r.status === 409)).toHaveLength(4);
    expect(await audit("refund.resolved")).toHaveLength(1);
  });

  it("paginates and rejects an invalid state", async () => {
    await makeAdmin("boss");
    expect((await acall("GET", "/api/admin/refunds?state=nope", { user: "boss" })).status).toBe(422);
    expect((await acall("GET", "/api/admin/refunds?limit=1&offset=0", { user: "boss" })).status).toBe(200);
  });
});

describe("audit trail", () => {
  it("every admin order change is recorded with who, what and when, visible on the order", async () => {
    await makeAdmin("boss");
    const boss = await profileIdOf("boss");
    const o = await paidOrder("alice");
    await setStatus(o.orderId, { to: "processing", note: "started" });
    await acall("PATCH", `/api/admin/orders/${o.orderId}/note`, { user: "boss", body: { note: "gift wrap" } });
    await setStatus(o.orderId, { to: "shipped", shipment: SHIPMENT });

    const rows = await audit();
    expect(rows.map((a) => a.action).sort()).toEqual(["order.note_changed", "order.status_changed", "order.status_changed"]);
    expect(rows.every((a) => a.actorProfileId === boss && a.entityType === "order" && a.entityId === o.orderId)).toBe(true);
    const shipRow = rows.find((a: any) => a.details.to === "shipped") as any;
    expect(shipRow.details).toMatchObject({ from: "processing", to: "shipped", shipment: { awb: "D1234567890" } });

    const detail = await acall("GET", `/api/admin/orders/${o.orderId}`, { user: "boss" });
    expect(detail.body.activity).toHaveLength(3);
    expect(detail.body.activity[0].actor.email).toBe("boss@example.com");
  });

  it("rejected or failed changes leave no audit entry and no partial effect", async () => {
    await makeAdmin("boss");
    const o = await paidOrder("alice");
    await setStatus(o.orderId, { to: "shipped" }); // 422: missing shipment
    await setStatus(o.orderId, { to: "delivered" }); // 409
    await acall("POST", `/api/admin/orders/${o.orderId}/refund/resolve`, { user: "boss", body: { reference: "rfnd_1", amountPaise: 100 } }); // 409
    expect(await audit()).toHaveLength(0);
    expect((await orderRow(o.orderId)).status).toBe("confirmed");
  });
});

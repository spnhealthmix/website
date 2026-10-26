import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

    if (!keySecret) {
      return NextResponse.json(
        { error: "Razorpay secret is not configured on server" },
        { status: 500 }
      );
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    // Accept both standard Razorpay naming and alternative keys
    const orderId =
      body.razorpay_order_id || body.order_id || body.razorpayOrderId;
    const paymentId =
      body.razorpay_payment_id || body.payment_id || body.razorpayPaymentId;
    const signature =
      body.razorpay_signature || body.signature || body.razorpaySignature;

    // Check for missing fields
    if (!orderId || !paymentId || !signature) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: razorpay_order_id, razorpay_payment_id, and razorpay_signature are required",
        },
        { status: 400 }
      );
    }

    // Algorithm: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
    const expectedSignature = crypto
      .createHmac("sha256", keySecret)
      .update(`${orderId}|${paymentId}`)
      .digest("hex");

    // Timing safe comparison to protect against timing attacks
    const expectedBuffer = Buffer.from(expectedSignature.toLowerCase(), "utf-8");
    const receivedBuffer = Buffer.from(
      String(signature).trim().toLowerCase(),
      "utf-8"
    );

    const isMatch =
      expectedBuffer.length === receivedBuffer.length &&
      crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

    if (!isMatch) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error:
            "Signature mismatch: generated signature does not match razorpay_signature",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        verified: true,
        message: "Payment verified successfully",
        order_id: orderId,
        payment_id: paymentId,
      },
      { status: 200 }
    );
  } catch (err: any) {
    console.error("Verify payment unexpected error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

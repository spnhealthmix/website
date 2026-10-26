import { NextResponse } from "next/server";
import Razorpay from "razorpay";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const keyId = (
      process.env.RAZORPAY_KEY_ID ||
      process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
      ""
    ).trim();
    const keySecret = (process.env.RAZORPAY_KEY_SECRET || "").trim();

    if (!keyId || !keySecret) {
      return NextResponse.json(
        { error: "Razorpay credentials are not configured on server" },
        { status: 401 }
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

    const { amount, currency = "INR", receipt, notes } = body;

    // Validate amount: must be present and >= 100 paise (₹1.00)
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount < 100) {
      return NextResponse.json(
        {
          error: "Invalid amount. Minimum amount is 100 paise (₹1.00)",
        },
        { status: 400 }
      );
    }

    const razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret,
    });

    const receiptStr = typeof receipt === "string" && receipt.trim()
      ? receipt.trim().slice(0, 40)
      : `rcpt_${Date.now()}`.slice(0, 40);

    try {
      const order = await razorpay.orders.create({
        amount: Math.round(numericAmount),
        currency: currency || "INR",
        receipt: receiptStr,
        notes: typeof notes === "object" && notes !== null ? notes : undefined,
      });

      return NextResponse.json(
        {
          order_id: order.id,
          amount: order.amount,
          currency: order.currency,
          key_id: keyId, // Safe public key ID for client initialization
        },
        { status: 200 }
      );
    } catch (apiError: any) {
      console.error("Razorpay order creation API error:", apiError);
      const status = apiError?.statusCode || apiError?.status;
      if (status === 401) {
        return NextResponse.json(
          { error: "Razorpay authentication failed: Invalid Key ID or Key Secret" },
          { status: 401 }
        );
      }

      const description =
        apiError?.error?.description ||
        apiError?.message ||
        "Razorpay order creation failed";

      return NextResponse.json(
        { error: description },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error("Create order unexpected server error:", err);
    return NextResponse.json(
      { error: err?.message || "Internal server error" },
      { status: 500 }
    );
  }
}

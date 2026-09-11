import { Request, Response } from "express";
import crypto from "crypto";
import { Booking } from "../../models/Booking";
import { User } from "../../models/User";
import { Transaction } from "../../models/Transaction";

// POST /api/v1/webhook/razorpay
// Failsafe handler for async Razorpay events
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET!;
    const signature = req.headers["x-razorpay-signature"] as string;

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(JSON.stringify(req.body))
      .digest("hex");

    if (expectedSignature !== signature) {
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    const event = req.body;

    if (event.event === "payment.captured") {
      const paymentId = event.payload.payment.entity.id;
      const orderId = event.payload.payment.entity.order_id;
      const amount = event.payload.payment.entity.amount / 100; // convert paise to INR

      // Find booking by razorpay order id (booking fee)
      const booking = await Booking.findOne({ "bookingFeePayment.razorpayOrderId": orderId });
      if (booking && booking.status === "pendingPayment") {
        await Booking.findByIdAndUpdate(booking._id, {
          status: "requested",
          "bookingFeePayment.razorpayPaymentId": paymentId,
          "bookingFeePayment.paidAt": new Date(),
        });

        await Transaction.create({
          userId: booking.customerId,
          bookingId: booking._id,
          title: "Booking Fee Paid (webhook)",
          amount,
          isCredit: false,
          type: "bookingFee",
          status: "completed",
          razorpayRef: paymentId,
        });
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};

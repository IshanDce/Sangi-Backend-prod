import { Request, Response } from "express";
import crypto from "crypto";
import { Booking } from "../../models/Booking";
import { User } from "../../models/User";
import { Transaction } from "../../models/Transaction";
import { sendPushNotification } from "../../utils/fcm";

// POST /api/v1/webhook/razorpay
// Failsafe handler for async Razorpay events
export const razorpayWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.warn("[Razorpay Webhook] RAZORPAY_WEBHOOK_SECRET is not configured");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    const signature = req.headers["x-razorpay-signature"] as string;
    if (!signature) {
      res.status(400).json({ error: "Missing x-razorpay-signature header" });
      return;
    }

    // Support both Buffer (from express.raw) and parsed object/string
    let rawBody: Buffer | string;
    let event: any;

    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
      try {
        event = JSON.parse(req.body.toString("utf8"));
      } catch (parseErr) {
        res.status(400).json({ error: "Malformed JSON payload in webhook" });
        return;
      }
    } else if (typeof req.body === "string") {
      rawBody = req.body;
      try {
        event = JSON.parse(req.body);
      } catch {
        res.status(400).json({ error: "Malformed JSON string in webhook" });
        return;
      }
    } else {
      rawBody = JSON.stringify(req.body);
      event = req.body;
    }

    const expectedSignature = crypto
      .createHmac("sha256", webhookSecret)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.warn("[Razorpay Webhook] Signature mismatch!");
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }

    if (event.event === "payment.captured") {
      const paymentId = event.payload?.payment?.entity?.id;
      const orderId = event.payload?.payment?.entity?.order_id;
      const amountPaise = event.payload?.payment?.entity?.amount;
      const amount = amountPaise ? amountPaise / 100 : 30; // paise to INR

      // Find booking by razorpay order id (booking fee) and atomically update ONLY if still pendingPayment
      const booking = await Booking.findOneAndUpdate(
        { "bookingFeePayment.razorpayOrderId": orderId, status: "pendingPayment" },
        {
          status: "requested",
          "bookingFeePayment.razorpayPaymentId": paymentId,
          "bookingFeePayment.paidAt": new Date(),
        },
        { new: true }
      );

      if (booking) {
        await Transaction.create({
          userId: booking.customerId,
          bookingId: booking._id,
          title: "Booking Fee Paid (webhook)",
          subtitle: `${booking.service} booking - ${booking.bookingNumber}`,
          amount,
          isCredit: false,
          type: "bookingFee",
          status: "completed",
          razorpayRef: paymentId,
        });

        // Notify staff of new booking
        const customer = await User.findById(booking.customerId);
        const staff = await User.findById(booking.staffId);
        if (staff?.fcmToken) {
          await sendPushNotification({
            userId: String(booking.staffId),
            fcmToken: staff.fcmToken,
            title: "New Booking Request",
            body: `${customer?.fullName || "A customer"} wants ${booking.service} on ${new Date(booking.date).toDateString()} at ${booking.timeSlot}`,
            type: "newBookingRequest",
            metadata: { bookingId: String(booking._id) },
          });
        }
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
};

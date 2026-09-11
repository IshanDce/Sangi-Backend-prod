"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayWebhook = void 0;
const crypto_1 = __importDefault(require("crypto"));
const Booking_1 = require("../../models/Booking");
const Transaction_1 = require("../../models/Transaction");
// POST /api/v1/webhook/razorpay
// Failsafe handler for async Razorpay events
const razorpayWebhook = async (req, res) => {
    try {
        const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];
        const expectedSignature = crypto_1.default
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
            const booking = await Booking_1.Booking.findOne({ "bookingFeePayment.razorpayOrderId": orderId });
            if (booking && booking.status === "pendingPayment") {
                await Booking_1.Booking.findByIdAndUpdate(booking._id, {
                    status: "requested",
                    "bookingFeePayment.razorpayPaymentId": paymentId,
                    "bookingFeePayment.paidAt": new Date(),
                });
                await Transaction_1.Transaction.create({
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
    }
    catch (err) {
        res.status(500).json({ error: String(err) });
    }
};
exports.razorpayWebhook = razorpayWebhook;
//# sourceMappingURL=webhooks.controller.js.map
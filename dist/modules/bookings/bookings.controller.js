"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServicePaymentOrder = exports.completeBookingWithReview = exports.payServiceFee = exports.completeService = exports.startService = exports.cancelBooking = exports.declineBooking = exports.acceptBooking = exports.getBookingById = exports.getStaffBookings = exports.getCustomerBookings = exports.confirmBookingPayment = exports.createOrder = void 0;
const Booking_1 = require("../../models/Booking");
const Transaction_1 = require("../../models/Transaction");
const Review_1 = require("../../models/Review");
const StaffProfile_1 = require("../../models/StaffProfile");
const User_1 = require("../../models/User");
const razorpay_1 = require("../../config/razorpay");
const razorpay_2 = require("../../utils/razorpay");
const fcm_1 = require("../../utils/fcm");
const BOOKING_FEE = 30;
// Helper: check if phones should be revealed
const isContactRevealed = (status) => ["accepted", "ongoing", "serviceCompleted", "paymentPending", "paymentCompleted", "completed"].includes(status);
// ─── POST /api/v1/bookings/create-order
// Creates a draft booking + Razorpay order for ₹30 booking fee
const createOrder = async (req, res) => {
    try {
        const { staffId, service, date, timeSlot, location, lat, lng, notes } = req.body;
        const booking = await Booking_1.Booking.create({
            customerId: req.user.id,
            staffId,
            service,
            date: new Date(date),
            timeSlot,
            location,
            coordinates: lat && lng ? { lat, lng } : undefined,
            notes,
            status: "pendingPayment",
            bookingFee: BOOKING_FEE,
        });
        let order;
        try {
            order = await razorpay_1.razorpay.orders.create({
                amount: BOOKING_FEE * 100, // paise
                currency: "INR",
                receipt: String(booking._id),
            });
        }
        catch (rzpErr) {
            console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
            order = { id: `order_mock_${Date.now()}` };
        }
        res.status(201).json({
            success: true,
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            razorpayOrderId: order.id,
            amount: BOOKING_FEE,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.createOrder = createOrder;
// ─── POST /api/v1/bookings/confirm-payment
// Verify Razorpay booking fee payment → status: requested → FCM to staff
const confirmBookingPayment = async (req, res) => {
    try {
        const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        const isValid = (0, razorpay_2.verifyRazorpaySignature)(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            res.status(400).json({ success: false, message: "Invalid payment signature" });
            return;
        }
        const booking = await Booking_1.Booking.findByIdAndUpdate(bookingId, {
            status: "requested",
            bookingFeePayment: { razorpayOrderId, razorpayPaymentId, paidAt: new Date() },
        }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // Log transaction
        await Transaction_1.Transaction.create({
            userId: req.user.id,
            bookingId: booking._id,
            title: "Booking Fee Paid",
            subtitle: `${booking.service} booking - ${booking.bookingNumber}`,
            amount: BOOKING_FEE,
            isCredit: false,
            type: "bookingFee",
            status: "completed",
            razorpayRef: razorpayPaymentId,
        });
        // Notify staff
        const customer = await User_1.User.findById(req.user.id);
        const staff = await User_1.User.findById(booking.staffId);
        if (staff?.fcmToken) {
            await (0, fcm_1.sendPushNotification)({
                userId: String(booking.staffId),
                fcmToken: staff.fcmToken,
                title: "New Booking Request 🔔",
                body: `${customer?.fullName} wants ${booking.service} on ${new Date(booking.date).toDateString()} at ${booking.timeSlot}`,
                type: "newBookingRequest",
                metadata: { bookingId: String(booking._id) },
            });
        }
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.confirmBookingPayment = confirmBookingPayment;
// ─── GET /api/v1/bookings/customer
const getCustomerBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const statusMap = {
            upcoming: ["requested", "accepted"],
            ongoing: ["ongoing"],
            completed: ["completed", "paymentCompleted", "cancelled", "declined"],
        };
        const statusFilter = status ? statusMap[status] : undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = { customerId: req.user.id };
        if (statusFilter)
            query.status = { $in: statusFilter };
        const bookings = await Booking_1.Booking.find(query)
            .populate("staffId", "fullName profilePhotoUrl")
            .sort({ createdAt: -1 });
        res.json({ success: true, bookings });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getCustomerBookings = getCustomerBookings;
// ─── GET /api/v1/bookings/staff
const getStaffBookings = async (req, res) => {
    try {
        const { status } = req.query;
        const statusMap = {
            pending: ["requested"],
            active: ["accepted", "ongoing"],
            completed: ["completed", "paymentCompleted", "cancelled", "declined"],
        };
        const statusFilter = status ? statusMap[status] : undefined;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const query = { staffId: req.user.id };
        if (statusFilter)
            query.status = { $in: statusFilter };
        const bookings = await Booking_1.Booking.find(query)
            .populate("customerId", "fullName profilePhotoUrl phone")
            .sort({ createdAt: -1 });
        // Mask phone based on status
        const masked = bookings.map((b) => {
            const bObj = b.toObject();
            if (!isContactRevealed(b.status)) {
                const customer = bObj.customerId;
                if (customer)
                    customer.phone = null;
            }
            return bObj;
        });
        res.json({ success: true, bookings: masked });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getStaffBookings = getStaffBookings;
// ─── GET /api/v1/bookings/:bookingId
const getBookingById = async (req, res) => {
    try {
        const booking = await Booking_1.Booking.findById(req.params.bookingId)
            .populate("customerId", "fullName profilePhotoUrl phone")
            .populate("staffId", "fullName profilePhotoUrl phone");
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        const bObj = booking.toObject();
        if (!isContactRevealed(booking.status)) {
            const customer = bObj.customerId;
            const staff = bObj.staffId;
            if (customer)
                customer.phone = null;
            if (staff)
                staff.phone = null;
        }
        res.json({ success: true, booking: bObj });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getBookingById = getBookingById;
// ─── PUT /api/v1/bookings/:bookingId/accept
const acceptBooking = async (req, res) => {
    try {
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "accepted" }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        const staff = await User_1.User.findById(req.user.id);
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Booking Accepted ✅",
            body: `${staff?.fullName} accepted your ${booking.service} request`,
            type: "bookingAccepted",
            metadata: { bookingId: String(booking._id) },
        });
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.acceptBooking = acceptBooking;
// ─── PUT /api/v1/bookings/:bookingId/decline
const declineBooking = async (req, res) => {
    try {
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "declined" }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // Refund ₹30 to customer wallet
        await User_1.User.findByIdAndUpdate(booking.customerId, { $inc: { walletBalance: BOOKING_FEE } });
        await Transaction_1.Transaction.create({
            userId: booking.customerId,
            bookingId: booking._id,
            title: "Booking Fee Refunded",
            subtitle: `${booking.service} booking declined`,
            amount: BOOKING_FEE,
            isCredit: true,
            type: "refund",
            status: "completed",
        });
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Booking Declined ❌",
            body: `Your booking was declined. ₹${BOOKING_FEE} refunded to wallet.`,
            type: "bookingDeclined",
            metadata: { bookingId: String(booking._id) },
        });
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.declineBooking = declineBooking;
// ─── PUT /api/v1/bookings/:bookingId/cancel
const cancelBooking = async (req, res) => {
    try {
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "cancelled" }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // TODO: apply cancellation policy (partial/full refund based on timing)
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.cancelBooking = cancelBooking;
// ─── PUT /api/v1/bookings/:bookingId/start
const startService = async (req, res) => {
    try {
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "ongoing" }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Service Started 🛠️",
            body: `Your ${booking.service} service has started`,
            type: "serviceStarted",
            metadata: { bookingId: String(booking._id) },
        });
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.startService = startService;
// ─── PUT /api/v1/bookings/:bookingId/complete  (Staff submits bill)
const completeService = async (req, res) => {
    try {
        const { serviceCharge, additionalCharge } = req.body;
        const total = (serviceCharge || 0) + (additionalCharge || 0);
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "paymentPending", serviceCharge, additionalCharge, totalServiceAmount: total }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Task Completed! 💰",
            body: `Pay ₹${total} to complete your ${booking.service} booking`,
            type: "paymentPending",
            metadata: { bookingId: String(booking._id), amount: total },
        });
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.completeService = completeService;
// ─── POST /api/v1/bookings/:bookingId/pay-service  (Customer pays staff fee)
const payServiceFee = async (req, res) => {
    try {
        const { method, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
        const booking = await Booking_1.Booking.findById(req.params.bookingId);
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        const amount = booking.totalServiceAmount;
        if (method === "wallet") {
            const customer = await User_1.User.findById(req.user.id);
            if (!customer || customer.walletBalance < amount) {
                res.status(400).json({ success: false, message: "Insufficient wallet balance" });
                return;
            }
            await User_1.User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: -amount } });
        }
        else {
            // Razorpay
            const isValid = (0, razorpay_2.verifyRazorpaySignature)(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                res.status(400).json({ success: false, message: "Invalid payment signature" });
                return;
            }
        }
        // Update booking
        await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, {
            status: "paymentCompleted",
            serviceFeePayment: {
                razorpayOrderId,
                razorpayPaymentId,
                paidAt: new Date(),
                method,
            },
        });
        // Credit staff wallet
        await User_1.User.findByIdAndUpdate(booking.staffId, { $inc: { walletBalance: amount } });
        // Transactions
        await Transaction_1.Transaction.create([
            {
                userId: req.user.id,
                bookingId: booking._id,
                title: "Service Payment",
                subtitle: `${booking.service} - ${booking.bookingNumber}`,
                amount,
                isCredit: false,
                type: "servicePayment",
                status: "completed",
                razorpayRef: razorpayPaymentId,
            },
            {
                userId: booking.staffId,
                bookingId: booking._id,
                title: "Payment Received",
                subtitle: `${booking.service} - ${booking.bookingNumber}`,
                amount,
                isCredit: true,
                type: "servicePayment",
                status: "completed",
                razorpayRef: razorpayPaymentId,
            },
        ]);
        // Notify staff
        const staff = await User_1.User.findById(booking.staffId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.staffId),
            fcmToken: staff?.fcmToken,
            title: "Payment Received 🎉",
            body: `₹${amount} received for ${booking.service} service!`,
            type: "paymentReceived",
            metadata: { bookingId: String(booking._id), amount },
        });
        res.json({ success: true, message: "Payment successful" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.payServiceFee = payServiceFee;
// ─── PUT /api/v1/bookings/:bookingId/complete-booking  (Customer submits review → Booking completed)
const completeBookingWithReview = async (req, res) => {
    try {
        const { rating, comment, tags } = req.body;
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "completed" }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // Save review
        await Review_1.Review.create({
            bookingId: booking._id,
            customerId: req.user.id,
            staffId: booking.staffId,
            rating,
            comment,
            tags: tags || [],
        });
        // Recalculate staff rating
        const reviews = await Review_1.Review.find({ staffId: booking.staffId });
        const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        await StaffProfile_1.StaffProfile.findOneAndUpdate({ userId: booking.staffId }, { rating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length });
        res.json({ success: true, message: "Booking completed and review saved" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.completeBookingWithReview = completeBookingWithReview;
// ─── POST /api/v1/bookings/create-service-order  (For Razorpay service payment)
const createServicePaymentOrder = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const booking = await Booking_1.Booking.findById(bookingId);
        if (!booking || !booking.totalServiceAmount) {
            res.status(404).json({ success: false, message: "Booking or amount not found" });
            return;
        }
        let order;
        try {
            order = await razorpay_1.razorpay.orders.create({
                amount: booking.totalServiceAmount * 100,
                currency: "INR",
                receipt: `svc_${String(booking._id)}`,
            });
        }
        catch (rzpErr) {
            console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
            order = { id: `order_mock_${Date.now()}` };
        }
        res.json({ success: true, razorpayOrderId: order.id, amount: booking.totalServiceAmount });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.createServicePaymentOrder = createServicePaymentOrder;
//# sourceMappingURL=bookings.controller.js.map
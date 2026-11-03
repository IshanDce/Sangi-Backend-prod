"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getStaffAvailability = exports.createServicePaymentOrder = exports.completeBookingWithReview = exports.payServiceFee = exports.completeService = exports.startService = exports.cancelBooking = exports.declineBooking = exports.acceptBooking = exports.getBookingById = exports.getStaffBookings = exports.getCustomerBookings = exports.confirmBookingPayment = exports.createOrder = void 0;
const Service_1 = require("../../models/Service");
const imagekit_1 = require("../../config/imagekit");
const Booking_1 = require("../../models/Booking");
const Transaction_1 = require("../../models/Transaction");
const Review_1 = require("../../models/Review");
const StaffProfile_1 = require("../../models/StaffProfile");
const User_1 = require("../../models/User");
const razorpay_1 = require("../../config/razorpay");
const razorpay_2 = require("../../utils/razorpay");
const fcm_1 = require("../../utils/fcm");
const timeSlot_1 = require("../../utils/timeSlot");
const BOOKING_FEE = 30;
// Helper: check if phones should be revealed
const isContactRevealed = (status) => ["accepted", "ongoing", "serviceCompleted", "paymentPending", "paymentCompleted", "completed"].includes(status);
// --- POST /api/v1/bookings/create-order
// Creates a draft booking + Razorpay order for ₹30 booking fee
const createOrder = async (req, res) => {
    try {
        const { staffId, service, date, timeSlot, location, lat, lng, notes } = req.body;
        // Validate staff profile and availability
        const staffProfile = await StaffProfile_1.StaffProfile.findOne({ userId: staffId });
        if (!staffProfile) {
            res.status(404).json({ success: false, message: "Selected staff member not found" });
            return;
        }
        // Check if staff offers the requested service
        if (service && staffProfile.services && staffProfile.services.length > 0) {
            if (!staffProfile.services.includes(service)) {
                res.status(400).json({ success: false, message: "Staff does not provide this service" });
                return;
            }
        }
        // Check staff availability for the requested day
        if (date && staffProfile.availability) {
            const bookingDate = new Date(date);
            const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
            const dayName = days[bookingDate.getDay()];
            const dayAvail = staffProfile.availability[dayName];
            if (dayAvail && dayAvail.isAvailable === false) {
                const dayCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
                res.status(400).json({
                    success: false,
                    message: `Staff is not available on ${dayCap}s`,
                });
                return;
            }
        }
        // ── Time-slot conflict check ──────────────────────────────────────────────
        {
            const dateStart = new Date(date);
            dateStart.setHours(0, 0, 0, 0);
            const dateEnd = new Date(date);
            dateEnd.setHours(23, 59, 59, 999);
            const existingBookings = await Booking_1.Booking.find({
                staffId,
                date: { $gte: dateStart, $lte: dateEnd },
                status: { $in: timeSlot_1.SLOT_OCCUPYING_STATUSES },
            });
            const reqSlot = (0, timeSlot_1.parseSlotToMinutes)(timeSlot);
            for (const eb of existingBookings) {
                const ebSlot = (0, timeSlot_1.parseSlotToMinutes)(eb.timeSlot);
                if ((0, timeSlot_1.slotsOverlap)(reqSlot, ebSlot)) {
                    const busySlots = existingBookings.map((b) => (0, timeSlot_1.parseSlotToMinutes)(b.timeSlot));
                    const suggestedSlots = (0, timeSlot_1.suggestAvailableSlots)(busySlots, 8 * 60, 20 * 60, 120, 60, 5);
                    res.status(409).json({
                        success: false,
                        errorCode: "TIME_SLOT_CONFLICT",
                        message: `Staff is not available at ${timeSlot}. Please choose another time.`,
                        conflictingSlot: eb.timeSlot,
                        suggestedSlots,
                    });
                    return;
                }
            }
        }
        // ─────────────────────────────────────────────────────────────────────────
        // Look up service in Service catalog for dynamic booking fee and active status
        let dynamicBookingFee = BOOKING_FEE;
        if (service) {
            const serviceDoc = await Service_1.Service.findOne({ slug: String(service).toLowerCase().trim() });
            if (serviceDoc) {
                if (!serviceDoc.isActive) {
                    res.status(400).json({
                        success: false,
                        message: `Service "${serviceDoc.name}" is currently inactive and not available for booking.`,
                    });
                    return;
                }
                if (serviceDoc.bookingFee !== undefined && serviceDoc.bookingFee !== null) {
                    dynamicBookingFee = Number(serviceDoc.bookingFee);
                }
            }
        }
        let booking;
        if (req.body.bookingId) {
            booking = await Booking_1.Booking.findById(req.body.bookingId);
        }
        if (!booking) {
            booking = await Booking_1.Booking.create({
                customerId: req.user.id,
                staffId,
                service,
                date: new Date(date),
                timeSlot: (0, timeSlot_1.normalizeTimeSlot)(timeSlot) || timeSlot,
                location,
                coordinates: lat && lng ? { lat, lng } : undefined,
                notes,
                status: "pendingPayment",
                bookingFee: dynamicBookingFee,
            });
        }
        let order;
        try {
            if ((0, razorpay_2.isMockMode)()) {
                order = { id: `order_mock_${booking._id}_${Date.now()}` };
            }
            else {
                order = await razorpay_1.razorpay.orders.create({
                    amount: Math.round(dynamicBookingFee * 100), // paise
                    currency: "INR",
                    receipt: String(booking._id),
                });
            }
        }
        catch (rzpErr) {
            console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
            order = { id: `order_mock_${booking._id}_${Date.now()}` };
        }
        // Persist razorpayOrderId on the booking so backend always has it for verification
        booking.bookingFeePayment = {
            razorpayOrderId: order.id,
        };
        await booking.save();
        res.status(201).json({
            success: true,
            bookingId: booking._id,
            bookingNumber: booking.bookingNumber,
            razorpayOrderId: order.id,
            amount: dynamicBookingFee,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.createOrder = createOrder;
// --- POST /api/v1/bookings/confirm-payment
// Verify Razorpay booking fee payment -> status: requested -> FCM to staff
const confirmBookingPayment = async (req, res) => {
    try {
        const { bookingId, razorpayPaymentId, razorpaySignature } = req.body;
        let { razorpayOrderId } = req.body;
        const booking = await Booking_1.Booking.findById(bookingId);
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // Resilient fallback: If client omitted razorpayOrderId, retrieve it from the booking!
        if (!razorpayOrderId && booking.bookingFeePayment?.razorpayOrderId) {
            razorpayOrderId = booking.bookingFeePayment.razorpayOrderId;
        }
        console.log(`[Confirm Booking] Validating signature for booking ${bookingId}: order=${razorpayOrderId}, payment=${razorpayPaymentId}`);
        const isValid = (0, razorpay_2.verifyRazorpaySignature)(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            res.status(400).json({ success: false, message: "Invalid payment signature" });
            return;
        }
        booking.status = "requested";
        booking.bookingFeePayment = {
            razorpayOrderId: razorpayOrderId || booking.bookingFeePayment?.razorpayOrderId || "",
            razorpayPaymentId,
            paidAt: new Date(),
        };
        await booking.save();
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
                title: "New Booking Request",
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
// --- GET /api/v1/bookings/customer
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
            .populate("staffId", "fullName profilePhotoUrl phone")
            .sort({ createdAt: -1 });
        // Attach review flag so the client can hide "Rate" button for already-reviewed bookings
        const completedBookingIds = bookings
            .filter((b) => ["completed", "paymentCompleted"].includes(b.status))
            .map((b) => b._id);
        const existingReviews = await Review_1.Review.find({ bookingId: { $in: completedBookingIds } }, "bookingId rating").lean();
        const reviewMap = {};
        for (const r of existingReviews) {
            reviewMap[String(r.bookingId)] = r;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bookingsWithReview = bookings.map((b) => {
            const plain = b.toObject();
            plain.review = reviewMap[String(b._id)] ?? null;
            return plain;
        });
        res.json({ success: true, bookings: bookingsWithReview });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getCustomerBookings = getCustomerBookings;
// --- GET /api/v1/bookings/staff
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
// --- GET /api/v1/bookings/:bookingId
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
        // Attach review so the client can hide "Rate Service" button if already reviewed
        const existingReview = await Review_1.Review.findOne({ bookingId: booking._id }, "bookingId rating").lean();
        bObj.review = existingReview ?? null;
        res.json({ success: true, booking: bObj });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getBookingById = getBookingById;
// --- PUT /api/v1/bookings/:bookingId/accept
const acceptBooking = async (req, res) => {
    try {
        // Only assigned staff or admin can accept, and only if status is strictly 'requested'
        const query = { _id: req.params.bookingId, status: "requested" };
        if (req.user?.role !== "admin") {
            query.staffId = req.user.id;
        }
        const booking = await Booking_1.Booking.findOneAndUpdate(query, { status: "accepted" }, { new: true });
        if (!booking) {
            res.status(400).json({
                success: false,
                message: "Booking cannot be accepted (it may have already been accepted, cancelled, or does not exist).",
            });
            return;
        }
        const staff = await User_1.User.findById(booking.staffId);
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Booking Accepted",
            body: `${staff?.fullName || "Staff"} accepted your ${booking.service} request`,
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
// --- PUT /api/v1/bookings/:bookingId/decline
const declineBooking = async (req, res) => {
    try {
        // Only assigned staff or admin can decline, and ONLY if status is strictly 'requested'
        const query = { _id: req.params.bookingId, status: "requested" };
        if (req.user?.role !== "admin") {
            query.staffId = req.user.id;
        }
        const booking = await Booking_1.Booking.findOneAndUpdate(query, { status: "declined" }, { new: true });
        if (!booking) {
            res.status(400).json({
                success: false,
                message: "Booking cannot be declined (it may have already been processed, cancelled, or does not exist).",
            });
            return;
        }
        const refundAmount = booking.bookingFee || BOOKING_FEE;
        // Refund fee to customer wallet (guaranteed exactly once)
        await User_1.User.findByIdAndUpdate(booking.customerId, { $inc: { walletBalance: refundAmount } });
        await Transaction_1.Transaction.create({
            userId: booking.customerId,
            bookingId: booking._id,
            title: "Booking Fee Refunded",
            subtitle: `${booking.service} booking declined`,
            amount: refundAmount,
            isCredit: true,
            type: "refund",
            status: "completed",
        });
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Booking Declined",
            body: `Your booking was declined. ₹${refundAmount} refunded to your wallet.`,
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
// --- PUT /api/v1/bookings/:bookingId/cancel
const cancelBooking = async (req, res) => {
    try {
        // Only customer, assigned staff, or admin can cancel, and only while booking is not completed/ongoing
        const query = {
            _id: req.params.bookingId,
            status: { $in: ["pendingPayment", "paymentSuccess", "requested", "accepted"] },
        };
        if (req.user?.role === "customer") {
            query.customerId = req.user.id;
        }
        else if (req.user?.role === "staff") {
            query.staffId = req.user.id;
        }
        const booking = await Booking_1.Booking.findOneAndUpdate(query, { status: "cancelled" }, { new: true });
        if (!booking) {
            res.status(400).json({
                success: false,
                message: "Booking cannot be cancelled in its current state or you are not authorized.",
            });
            return;
        }
        res.json({ success: true, booking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.cancelBooking = cancelBooking;
// --- PUT /api/v1/bookings/:bookingId/start
const startService = async (req, res) => {
    try {
        // Only assigned staff or admin can start service, and only if currently 'accepted'
        const query = { _id: req.params.bookingId, status: "accepted" };
        if (req.user?.role !== "admin") {
            query.staffId = req.user.id;
        }
        const booking = await Booking_1.Booking.findOneAndUpdate(query, { status: "ongoing" }, { new: true });
        if (!booking) {
            res.status(400).json({
                success: false,
                message: "Service cannot be started (booking is not in accepted status).",
            });
            return;
        }
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Service Started",
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
// --- PUT /api/v1/bookings/:bookingId/complete  (Staff submits bill)
const completeService = async (req, res) => {
    try {
        const { serviceCharge, additionalCharge } = req.body;
        const total = (Number(serviceCharge) || 0) + (Number(additionalCharge) || 0);
        if (total <= 0) {
            res.status(400).json({ success: false, message: "Please enter a valid service amount" });
            return;
        }
        // Only assigned staff or admin can complete, and only if currently 'ongoing'
        const query = { _id: req.params.bookingId, status: "ongoing" };
        if (req.user?.role !== "admin") {
            query.staffId = req.user.id;
        }
        const booking = await Booking_1.Booking.findOneAndUpdate(query, {
            status: "paymentPending",
            serviceCharge: Number(serviceCharge) || 0,
            additionalCharge: Number(additionalCharge) || 0,
            totalServiceAmount: total,
        }, { new: true });
        if (!booking) {
            res.status(400).json({
                success: false,
                message: "Work cannot be marked complete (booking is not ongoing or already completed).",
            });
            return;
        }
        const customer = await User_1.User.findById(booking.customerId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.customerId),
            fcmToken: customer?.fcmToken,
            title: "Task Completed!",
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
// --- POST /api/v1/bookings/:bookingId/pay-service  (Customer pays staff fee)
const payServiceFee = async (req, res) => {
    try {
        const { method, razorpayPaymentId, razorpaySignature } = req.body;
        let { razorpayOrderId } = req.body;
        // Validate booking is strictly pending payment and belongs to caller
        const booking = await Booking_1.Booking.findOne({
            _id: req.params.bookingId,
            status: "paymentPending",
            ...(req.user?.role !== "admin" ? { customerId: req.user.id } : {}),
        });
        if (!booking) {
            res.status(400).json({
                success: false,
                message: "Booking is not awaiting payment or has already been paid.",
            });
            return;
        }
        // Resilient fallback: retrieve saved orderId from booking if missing from request body
        if (!razorpayOrderId && booking.serviceFeePayment?.razorpayOrderId) {
            razorpayOrderId = booking.serviceFeePayment.razorpayOrderId;
        }
        const amount = booking.totalServiceAmount || ((booking.serviceCharge || 0) + (booking.additionalCharge || 0)) || 0;
        if (amount <= 0) {
            res.status(400).json({ success: false, message: "Invalid service charge amount" });
            return;
        }
        const commission = amount * 0.25;
        const staffAmount = amount * 0.75;
        if (method === "wallet") {
            // Atomic deduction: only deduct if balance >= amount
            const customer = await User_1.User.findOneAndUpdate({ _id: req.user.id, walletBalance: { $gte: amount } }, { $inc: { walletBalance: -amount } }, { new: true });
            if (!customer) {
                res.status(400).json({ success: false, message: "Insufficient wallet balance" });
                return;
            }
        }
        else {
            // Razorpay payment verification
            const isValid = (0, razorpay_2.verifyRazorpaySignature)(razorpayOrderId, razorpayPaymentId, razorpaySignature);
            if (!isValid) {
                res.status(400).json({ success: false, message: "Invalid payment signature" });
                return;
            }
        }
        // Atomic booking status transition: ensure status was still paymentPending
        const updatedBooking = await Booking_1.Booking.findOneAndUpdate({ _id: req.params.bookingId, status: "paymentPending" }, {
            status: "paymentCompleted",
            serviceFeePayment: {
                razorpayOrderId,
                razorpayPaymentId,
                paidAt: new Date(),
                method,
            },
        }, { new: true });
        if (!updatedBooking) {
            // Rollback wallet if deducted
            if (method === "wallet") {
                await User_1.User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: amount } });
            }
            res.status(400).json({ success: false, message: "Payment already recorded for this booking" });
            return;
        }
        // Credit staff wallet with 75%
        await User_1.User.findByIdAndUpdate(booking.staffId, { $inc: { walletBalance: staffAmount } });
        // Transactions (3 records)
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
                amount: staffAmount,
                isCredit: true,
                type: "servicePayment",
                status: "completed",
                razorpayRef: razorpayPaymentId,
            },
            {
                userId: booking.staffId,
                bookingId: booking._id,
                title: "Platform Commission",
                subtitle: `25% SANGI fee - ${booking.bookingNumber}`,
                amount: commission,
                isCredit: false,
                type: "adjustment",
                status: "completed",
            },
        ]);
        // Notify staff
        const staff = await User_1.User.findById(booking.staffId);
        await (0, fcm_1.sendPushNotification)({
            userId: String(booking.staffId),
            fcmToken: staff?.fcmToken,
            title: "Payment Received",
            body: `₹${staffAmount} received for ${booking.service} service!`,
            type: "paymentReceived",
            metadata: { bookingId: String(booking._id), amount: staffAmount },
        });
        res.json({ success: true, message: "Payment successful", booking: updatedBooking });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.payServiceFee = payServiceFee;
// --- PUT /api/v1/bookings/:bookingId/complete-booking  (Customer submits review -> Booking completed)
// Accepts multipart with optional images[] (up to 3 photos)
const completeBookingWithReview = async (req, res) => {
    try {
        const { rating, comment, tags } = req.body;
        const booking = await Booking_1.Booking.findByIdAndUpdate(req.params.bookingId, { status: "completed" }, { new: true });
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        // Upload review images to ImageKit (if any)
        const imageUrls = [];
        const files = req.files;
        if (files && files.length > 0) {
            for (const file of files.slice(0, 3)) { // max 3 images
                const b64 = file.buffer.toString("base64");
                const result = await imagekit_1.imagekit.upload({
                    file: b64,
                    fileName: `review_${booking._id}_${Date.now()}.jpg`,
                    folder: "/sangi/reviews/",
                });
                imageUrls.push(result.url);
            }
        }
        // Parse tags — might arrive as JSON string from multipart form
        let parsedTags = [];
        if (tags) {
            if (typeof tags === "string") {
                try {
                    parsedTags = JSON.parse(tags);
                }
                catch {
                    parsedTags = [tags];
                }
            }
            else if (Array.isArray(tags)) {
                parsedTags = tags;
            }
        }
        // Save review with images
        await Review_1.Review.create({
            bookingId: booking._id,
            customerId: req.user.id,
            staffId: booking.staffId,
            rating: Number(rating),
            comment,
            tags: parsedTags,
            images: imageUrls,
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
// --- POST /api/v1/bookings/create-service-order  (For Razorpay service payment)
const createServicePaymentOrder = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const booking = await Booking_1.Booking.findById(bookingId);
        if (!booking) {
            res.status(404).json({ success: false, message: "Booking not found" });
            return;
        }
        const amount = booking.totalServiceAmount || ((booking.serviceCharge || 0) + (booking.additionalCharge || 0)) || 0;
        if (amount <= 0) {
            res.status(400).json({ success: false, message: "Service charge not set yet" });
            return;
        }
        let order;
        try {
            if ((0, razorpay_2.isMockMode)()) {
                order = { id: `order_mock_${booking._id}_${Date.now()}` };
            }
            else {
                order = await razorpay_1.razorpay.orders.create({
                    amount: Math.round(amount * 100),
                    currency: "INR",
                    receipt: `svc_${String(booking._id)}`,
                });
            }
        }
        catch (rzpErr) {
            console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
            order = { id: `order_mock_${booking._id}_${Date.now()}` };
        }
        // Persist razorpayOrderId on the booking
        booking.serviceFeePayment = {
            razorpayOrderId: order.id,
        };
        await booking.save();
        res.json({ success: true, razorpayOrderId: order.id, amount });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.createServicePaymentOrder = createServicePaymentOrder;
// ─── GET /api/v1/bookings/staff-availability ─────────────────────────────────
const getStaffAvailability = async (req, res) => {
    try {
        const { staffId, date } = req.query;
        if (!staffId || !date) {
            res.status(400).json({ success: false, message: "staffId and date are required" });
            return;
        }
        const dateStart = new Date(date);
        dateStart.setHours(0, 0, 0, 0);
        const dateEnd = new Date(date);
        dateEnd.setHours(23, 59, 59, 999);
        const bookings = await Booking_1.Booking.find({
            staffId,
            date: { ['$gte']: dateStart, ['$lte']: dateEnd },
            status: { ['$in']: timeSlot_1.SLOT_OCCUPYING_STATUSES },
        }).select("timeSlot status");
        const busyRanges = bookings.map((b) => (0, timeSlot_1.parseSlotToMinutes)(b.timeSlot));
        const suggested = (0, timeSlot_1.suggestAvailableSlots)(busyRanges, 8 * 60, 20 * 60, 120, 60, 8);
        res.json({
            success: true,
            date,
            staffId,
            busySlots: bookings.map((b) => ({ timeSlot: b.timeSlot, status: b.status })),
            suggestedSlots: suggested,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getStaffAvailability = getStaffAvailability;
//# sourceMappingURL=bookings.controller.js.map
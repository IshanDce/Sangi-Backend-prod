import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { Booking } from "../../models/Booking";
import { Transaction } from "../../models/Transaction";
import { Review } from "../../models/Review";
import { StaffProfile } from "../../models/StaffProfile";
import { User } from "../../models/User";
import { razorpay } from "../../config/razorpay";
import { verifyRazorpaySignature, isMockMode } from "../../utils/razorpay";
import { sendPushNotification } from "../../utils/fcm";
import { parseSlotToMinutes, slotsOverlap, suggestAvailableSlots, SLOT_OCCUPYING_STATUSES, normalizeTimeSlot } from "../../utils/timeSlot";

const BOOKING_FEE = 30;

// Helper: check if phones should be revealed
const isContactRevealed = (status: string) =>
  ["accepted", "ongoing", "serviceCompleted", "paymentPending", "paymentCompleted", "completed"].includes(status);

// --- POST /api/v1/bookings/create-order
// Creates a draft booking + Razorpay order for ₹30 booking fee
export const createOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId, service, date, timeSlot, location, lat, lng, notes } = req.body;

    // Validate staff profile and availability
    const staffProfile = await StaffProfile.findOne({ userId: staffId });
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
      const dayAvail = (staffProfile.availability as any)[dayName];
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
      const dateStart = new Date(date); dateStart.setHours(0, 0, 0, 0);
      const dateEnd   = new Date(date); dateEnd.setHours(23, 59, 59, 999);
      const existingBookings = await Booking.find({
        staffId,
        date:   { $gte: dateStart, $lte: dateEnd },
        status: { $in: SLOT_OCCUPYING_STATUSES },
      } as any);
      const reqSlot = parseSlotToMinutes(timeSlot);
      for (const eb of existingBookings) {
        const ebSlot = parseSlotToMinutes(eb.timeSlot);
        if (slotsOverlap(reqSlot, ebSlot)) {
          const busySlots = existingBookings.map((b) => parseSlotToMinutes(b.timeSlot));
          const suggestedSlots = suggestAvailableSlots(busySlots, 8 * 60, 20 * 60, 120, 60, 5);
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

    const booking = await Booking.create({
      customerId: req.user!.id,
      staffId,
      service,
      date: new Date(date),
      timeSlot: normalizeTimeSlot(timeSlot) || timeSlot,
      location,
      coordinates: lat && lng ? { lat, lng } : undefined,
      notes,
      status: "pendingPayment",
      bookingFee: BOOKING_FEE,
    });

    let order: { id: string };
    try {
      if (isMockMode()) {
        order = { id: `order_mock_${booking._id}_${Date.now()}` };
      } else {
        order = await razorpay.orders.create({
          amount: BOOKING_FEE * 100, // paise
          currency: "INR",
          receipt: String(booking._id),
        });
      }
    } catch (rzpErr) {
      console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
      order = { id: `order_mock_${booking._id}_${Date.now()}` };
    }

    res.status(201).json({
      success: true,
      bookingId: booking._id,
      bookingNumber: booking.bookingNumber,
      razorpayOrderId: order.id,
      amount: BOOKING_FEE,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- POST /api/v1/bookings/confirm-payment
// Verify Razorpay booking fee payment -> status: requested -> FCM to staff
export const confirmBookingPayment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) { res.status(400).json({ success: false, message: "Invalid payment signature" }); return; }

    const booking = await Booking.findByIdAndUpdate(
      bookingId,
      {
        status: "requested",
        bookingFeePayment: { razorpayOrderId, razorpayPaymentId, paidAt: new Date() },
      },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    // Log transaction
    await Transaction.create({
      userId: req.user!.id,
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
    const customer = await User.findById(req.user!.id);
    const staff = await User.findById(booking.staffId);
    if (staff?.fcmToken) {
      await sendPushNotification({
        userId: String(booking.staffId),
        fcmToken: staff.fcmToken,
        title: "New Booking Request",
        body: `${customer?.fullName} wants ${booking.service} on ${new Date(booking.date).toDateString()} at ${booking.timeSlot}`,
        type: "newBookingRequest",
        metadata: { bookingId: String(booking._id) },
      });
    }

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- GET /api/v1/bookings/customer
export const getCustomerBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const statusMap: Record<string, string[]> = {
      upcoming: ["requested", "accepted"],
      ongoing: ["ongoing"],
      completed: ["completed", "paymentCompleted", "cancelled", "declined"],
    };
    const statusFilter = status ? statusMap[status as string] : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { customerId: req.user!.id };
    if (statusFilter) query.status = { $in: statusFilter };
    const bookings = await Booking.find(query)
      .populate("staffId", "fullName profilePhotoUrl phone")
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- GET /api/v1/bookings/staff
export const getStaffBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status } = req.query;
    const statusMap: Record<string, string[]> = {
      pending: ["requested"],
      active: ["accepted", "ongoing"],
      completed: ["completed", "paymentCompleted", "cancelled", "declined"],
    };
    const statusFilter = status ? statusMap[status as string] : undefined;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = { staffId: req.user!.id };
    if (statusFilter) query.status = { $in: statusFilter };
    const bookings = await Booking.find(query)
      .populate("customerId", "fullName profilePhotoUrl phone")
      .sort({ createdAt: -1 });

    // Mask phone based on status
    const masked = bookings.map((b) => {
      const bObj = b.toObject() as unknown as Record<string, unknown>;
      if (!isContactRevealed(b.status)) {
        const customer = bObj.customerId as Record<string, unknown>;
        if (customer) customer.phone = null;
      }
      return bObj;
    });

    res.json({ success: true, bookings: masked });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- GET /api/v1/bookings/:bookingId
export const getBookingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.bookingId)
      .populate("customerId", "fullName profilePhotoUrl phone")
      .populate("staffId", "fullName profilePhotoUrl phone");

    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    const bObj = booking.toObject() as unknown as Record<string, unknown>;

    if (!isContactRevealed(booking.status)) {
      const customer = bObj.customerId as Record<string, unknown>;
      const staff = bObj.staffId as Record<string, unknown>;
      if (customer) customer.phone = null;
      if (staff) staff.phone = null;
    }

    res.json({ success: true, booking: bObj });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- PUT /api/v1/bookings/:bookingId/accept
export const acceptBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { status: "accepted" },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    const staff = await User.findById(req.user!.id);
    const customer = await User.findById(booking.customerId);

    await sendPushNotification({
      userId: String(booking.customerId),
      fcmToken: customer?.fcmToken,
      title: "Booking Accepted",
      body: `${staff?.fullName} accepted your ${booking.service} request`,
      type: "bookingAccepted",
      metadata: { bookingId: String(booking._id) },
    });

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- PUT /api/v1/bookings/:bookingId/decline
export const declineBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { status: "declined" },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    // Refund ₹30 to customer wallet
    await User.findByIdAndUpdate(booking.customerId, { $inc: { walletBalance: BOOKING_FEE } });
    await Transaction.create({
      userId: booking.customerId,
      bookingId: booking._id,
      title: "Booking Fee Refunded",
      subtitle: `${booking.service} booking declined`,
      amount: BOOKING_FEE,
      isCredit: true,
      type: "refund",
      status: "completed",
    });

    const customer = await User.findById(booking.customerId);
    await sendPushNotification({
      userId: String(booking.customerId),
      fcmToken: customer?.fcmToken,
      title: "Booking Declined",
      body: `Your booking was declined. ₹${BOOKING_FEE} refunded to wallet.`,
      type: "bookingDeclined",
      metadata: { bookingId: String(booking._id) },
    });

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- PUT /api/v1/bookings/:bookingId/cancel
export const cancelBooking = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { status: "cancelled" },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }
    // TODO: apply cancellation policy (partial/full refund based on timing)
    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- PUT /api/v1/bookings/:bookingId/start
export const startService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { status: "ongoing" },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    const customer = await User.findById(booking.customerId);
    await sendPushNotification({
      userId: String(booking.customerId),
      fcmToken: customer?.fcmToken,
      title: "Service Started",
      body: `Your ${booking.service} service has started`,
      type: "serviceStarted",
      metadata: { bookingId: String(booking._id) },
    });

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- PUT /api/v1/bookings/:bookingId/complete  (Staff submits bill)
export const completeService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { serviceCharge, additionalCharge } = req.body;
    const total = (serviceCharge || 0) + (additionalCharge || 0);

    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { status: "paymentPending", serviceCharge, additionalCharge, totalServiceAmount: total },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    const customer = await User.findById(booking.customerId);
    await sendPushNotification({
      userId: String(booking.customerId),
      fcmToken: customer?.fcmToken,
      title: "Task Completed!",
      body: `Pay ₹${total} to complete your ${booking.service} booking`,
      type: "paymentPending",
      metadata: { bookingId: String(booking._id), amount: total },
    });

    res.json({ success: true, booking });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- POST /api/v1/bookings/:bookingId/pay-service  (Customer pays staff fee)
export const payServiceFee = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { method, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const booking = await Booking.findById(req.params.bookingId);
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    const amount = booking.totalServiceAmount!;
    const commission = amount * 0.25;
    const staffAmount = amount * 0.75;

    if (method === "wallet") {
      const customer = await User.findById(req.user!.id);
      if (!customer || customer.walletBalance < amount) {
        res.status(400).json({ success: false, message: "Insufficient wallet balance" });
        return;
      }
      await User.findByIdAndUpdate(req.user!.id, { $inc: { walletBalance: -amount } });
    } else {
      // Razorpay
      const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      if (!isValid) { res.status(400).json({ success: false, message: "Invalid payment signature" }); return; }
    }

    // Update booking
    await Booking.findByIdAndUpdate(req.params.bookingId, {
      status: "paymentCompleted",
      serviceFeePayment: {
        razorpayOrderId,
        razorpayPaymentId,
        paidAt: new Date(),
        method,
      },
    });

    // Credit staff wallet with 75%
    await User.findByIdAndUpdate(booking.staffId, { $inc: { walletBalance: staffAmount } });

    // Transactions (3 records)
    await Transaction.create([
      {
        userId: req.user!.id,
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
    const staff = await User.findById(booking.staffId);
    await sendPushNotification({
      userId: String(booking.staffId),
      fcmToken: staff?.fcmToken,
      title: "Payment Received",
      body: `₹${staffAmount} received for ${booking.service} service!`,
      type: "paymentReceived",
      metadata: { bookingId: String(booking._id), amount: staffAmount },
    });

    res.json({ success: true, message: "Payment successful" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- PUT /api/v1/bookings/:bookingId/complete-booking  (Customer submits review -> Booking completed)
export const completeBookingWithReview = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rating, comment, tags } = req.body;
    const booking = await Booking.findByIdAndUpdate(
      req.params.bookingId,
      { status: "completed" },
      { new: true }
    );
    if (!booking) { res.status(404).json({ success: false, message: "Booking not found" }); return; }

    // Save review
    await Review.create({
      bookingId: booking._id,
      customerId: req.user!.id,
      staffId: booking.staffId,
      rating,
      comment,
      tags: tags || [],
    });

    // Recalculate staff rating
    const reviews = await Review.find({ staffId: booking.staffId });
    const avgRating = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    await StaffProfile.findOneAndUpdate(
      { userId: booking.staffId },
      { rating: Math.round(avgRating * 10) / 10, reviewCount: reviews.length }
    );

    res.json({ success: true, message: "Booking completed and review saved" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// --- POST /api/v1/bookings/create-service-order  (For Razorpay service payment)
export const createServicePaymentOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId);
    if (!booking || !booking.totalServiceAmount) {
      res.status(404).json({ success: false, message: "Booking or amount not found" });
      return;
    }
    let order: { id: string };
    try {
      if (isMockMode()) {
        order = { id: `order_mock_${booking._id}_${Date.now()}` };
      } else {
        order = await razorpay.orders.create({
          amount: booking.totalServiceAmount * 100,
          currency: "INR",
          receipt: `svc_${String(booking._id)}`,
        });
      }
    } catch (rzpErr) {
      console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
      order = { id: `order_mock_${booking._id}_${Date.now()}` };
    }
    res.json({ success: true, razorpayOrderId: order.id, amount: booking.totalServiceAmount });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// ─── GET /api/v1/bookings/staff-availability ─────────────────────────────────
export const getStaffAvailability = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { staffId, date } = req.query as { staffId?: string; date?: string };
    if (!staffId || !date) {
      res.status(400).json({ success: false, message: "staffId and date are required" });
      return;
    }
    const dateStart = new Date(date); dateStart.setHours(0, 0, 0, 0);
    const dateEnd   = new Date(date); dateEnd.setHours(23, 59, 59, 999);
    const bookings = await Booking.find({
      staffId,
      date: { ['$gte']: dateStart, ['$lte']: dateEnd },
      status: { ['$in']: SLOT_OCCUPYING_STATUSES },
    } as any).select("timeSlot status");
    const busyRanges = bookings.map((b) => parseSlotToMinutes(b.timeSlot));
    const suggested = suggestAvailableSlots(busyRanges, 8 * 60, 20 * 60, 120, 60, 8);
    res.json({
      success: true,
      date,
      staffId,
      busySlots: bookings.map((b) => ({ timeSlot: b.timeSlot, status: b.status })),
      suggestedSlots: suggested,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};


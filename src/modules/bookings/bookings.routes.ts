import { Router } from "express";
import {
  createOrder, confirmBookingPayment, getCustomerBookings, getStaffBookings,
  getBookingById, acceptBooking, declineBooking, cancelBooking,
  startService, completeService, payServiceFee, completeBookingWithReview,
  createServicePaymentOrder, getStaffAvailability,
} from "./bookings.controller";
import { protect, requireRole } from "../../middleware/auth";

const router = Router();

router.use(protect);

// Customer actions
router.post("/create-order", requireRole("customer"), createOrder);
router.post("/confirm-payment", requireRole("customer"), confirmBookingPayment);
router.post("/create-service-order", requireRole("customer"), createServicePaymentOrder);
router.get("/customer", requireRole("customer"), getCustomerBookings);
router.post("/:bookingId/pay-service", requireRole("customer"), payServiceFee);
router.put("/:bookingId/complete-booking", requireRole("customer"), completeBookingWithReview);
router.put("/:bookingId/cancel", cancelBooking);

// Staff actions
router.get("/staff", requireRole("staff"), getStaffBookings);
router.put("/:bookingId/accept", requireRole("staff"), acceptBooking);
router.put("/:bookingId/decline", requireRole("staff"), declineBooking);
router.put("/:bookingId/start", requireRole("staff"), startService);
router.put("/:bookingId/complete", requireRole("staff"), completeService);

// Staff availability (used by customer booking form)
router.get("/staff-availability", getStaffAvailability);

// Shared
router.get("/:bookingId", getBookingById);

export default router;


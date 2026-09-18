"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bookings_controller_1 = require("./bookings.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
// Customer actions
router.post("/create-order", (0, auth_1.requireRole)("customer"), bookings_controller_1.createOrder);
router.post("/confirm-payment", (0, auth_1.requireRole)("customer"), bookings_controller_1.confirmBookingPayment);
router.post("/create-service-order", (0, auth_1.requireRole)("customer"), bookings_controller_1.createServicePaymentOrder);
router.get("/customer", (0, auth_1.requireRole)("customer"), bookings_controller_1.getCustomerBookings);
router.post("/:bookingId/pay-service", (0, auth_1.requireRole)("customer"), bookings_controller_1.payServiceFee);
router.put("/:bookingId/complete-booking", (0, auth_1.requireRole)("customer"), bookings_controller_1.completeBookingWithReview);
router.put("/:bookingId/cancel", bookings_controller_1.cancelBooking);
// Staff actions
router.get("/staff", (0, auth_1.requireRole)("staff"), bookings_controller_1.getStaffBookings);
router.put("/:bookingId/accept", (0, auth_1.requireRole)("staff"), bookings_controller_1.acceptBooking);
router.put("/:bookingId/decline", (0, auth_1.requireRole)("staff"), bookings_controller_1.declineBooking);
router.put("/:bookingId/start", (0, auth_1.requireRole)("staff"), bookings_controller_1.startService);
router.put("/:bookingId/complete", (0, auth_1.requireRole)("staff"), bookings_controller_1.completeService);
// Staff availability (used by customer booking form)
router.get("/staff-availability", bookings_controller_1.getStaffAvailability);
// Shared
router.get("/:bookingId", bookings_controller_1.getBookingById);
exports.default = router;
//# sourceMappingURL=bookings.routes.js.map
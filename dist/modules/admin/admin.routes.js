"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const admin_controller_1 = require("./admin.controller");
const router = (0, express_1.Router)();
// Public Admin Auth
router.post('/auth/login', admin_controller_1.adminLogin);
// Protected Admin Routes
router.use(auth_1.protect, auth_1.requireAdmin);
router.get('/auth/me', admin_controller_1.getAdminProfile);
router.get('/dashboard/stats', admin_controller_1.getDashboardStats);
// Customers
router.get('/customers', admin_controller_1.getCustomers);
router.get('/customers/:id', admin_controller_1.getCustomerById);
// Staff & KYC
router.get('/staff', admin_controller_1.getStaff);
router.get('/staff/:id', admin_controller_1.getStaffById);
router.put('/staff/:id/kyc', admin_controller_1.updateStaffKyc);
// User Blocking
router.put('/users/:id/block', admin_controller_1.toggleBlockUser);
// Bookings & Live GPS
router.get('/bookings', admin_controller_1.getBookings);
router.get('/bookings/:id', admin_controller_1.getBookingById);
// Services & Pricing
router.get('/services', admin_controller_1.getServices);
router.post('/services', admin_controller_1.createService);
router.put('/services/:id', admin_controller_1.updateService);
router.delete('/services/:id', admin_controller_1.deleteService);
// Withdrawals
router.get('/withdrawals', admin_controller_1.getWithdrawals);
router.put('/withdrawals/:id/approve', admin_controller_1.approveWithdrawal);
router.put('/withdrawals/:id/reject', admin_controller_1.rejectWithdrawal);
// Bank Accounts Directory
router.get('/bank-accounts', admin_controller_1.getBankAccounts);
// Notifications
router.post('/notifications/send', admin_controller_1.sendNotification);
router.get('/notifications/history', admin_controller_1.getNotificationHistory);
exports.default = router;
//# sourceMappingURL=admin.routes.js.map
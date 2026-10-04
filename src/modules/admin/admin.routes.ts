import { Router } from 'express';
import { protect, requireAdmin } from '../../middleware/auth';
import {
  adminLogin,
  getAdminProfile,
  getDashboardStats,
  getCustomers,
  getCustomerById,
  getStaff,
  getStaffById,
  updateStaffKyc,
  toggleBlockUser,
  getBookings,
  getBookingById,
  getServices,
  createService,
  updateService,
  deleteService,
  getWithdrawals,
  approveWithdrawal,
  rejectWithdrawal,
  getBankAccounts,
  sendNotification,
  getNotificationHistory,
} from './admin.controller';

const router = Router();

// Public Admin Auth
router.post('/auth/login', adminLogin);

// Protected Admin Routes
router.use(protect, requireAdmin);

router.get('/auth/me', getAdminProfile);
router.get('/dashboard/stats', getDashboardStats);

// Customers
router.get('/customers', getCustomers);
router.get('/customers/:id', getCustomerById);

// Staff & KYC
router.get('/staff', getStaff);
router.get('/staff/:id', getStaffById);
router.put('/staff/:id/kyc', updateStaffKyc);

// User Blocking
router.put('/users/:id/block', toggleBlockUser);

// Bookings & Live GPS
router.get('/bookings', getBookings);
router.get('/bookings/:id', getBookingById);

// Services & Pricing
router.get('/services', getServices);
router.post('/services', createService);
router.put('/services/:id', updateService);
router.delete('/services/:id', deleteService);

// Withdrawals
router.get('/withdrawals', getWithdrawals);
router.put('/withdrawals/:id/approve', approveWithdrawal);
router.put('/withdrawals/:id/reject', rejectWithdrawal);

// Bank Accounts Directory
router.get('/bank-accounts', getBankAccounts);

// Notifications
router.post('/notifications/send', sendNotification);
router.get('/notifications/history', getNotificationHistory);

export default router;

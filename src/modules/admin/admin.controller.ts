import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { User, IUser } from '../../models/User';
import { StaffProfile } from '../../models/StaffProfile';
import { Booking } from '../../models/Booking';
import { Transaction } from '../../models/Transaction';
import { Notification } from '../../models/Notification';
import { Service } from '../../models/Service';
import { WithdrawalRequest } from '../../models/WithdrawalRequest';
import { AuthRequest } from '../../middleware/auth';
import { sendPushNotification } from '../../utils/fcm';

// ══════════════════════════════════════════════════════════════════════
// 1. ADMIN AUTHENTICATION
// ══════════════════════════════════════════════════════════════════════

// POST /api/v1/admin/auth/login
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    if (user.role !== 'admin') {
      res.status(403).json({ success: false, message: 'Access denied. Administrator privileges required.' });
      return;
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Login failed' });
  }
};

// GET /api/v1/admin/auth/me
export const getAdminProfile = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, message: 'Admin user not found' });
      return;
    }
    res.json({ success: true, user });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 2. DASHBOARD STATS
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/dashboard/stats
export const getDashboardStats = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [
      totalCustomers,
      totalStaff,
      pendingKycCount,
      approvedStaffCount,
      totalBookings,
      ongoingBookings,
      completedBookings,
      pendingWithdrawals,
      servicesCount,
    ] = await Promise.all([
      User.countDocuments({ role: 'customer' }),
      User.countDocuments({ role: 'staff' }),
      StaffProfile.countDocuments({ kycStatus: 'pending' }),
      StaffProfile.countDocuments({ kycStatus: 'approved' }),
      Booking.countDocuments(),
      Booking.countDocuments({ status: { $in: ['accepted', 'ongoing'] } }),
      Booking.countDocuments({ status: { $in: ['completed', 'serviceCompleted', 'paymentCompleted'] } }),
      WithdrawalRequest.countDocuments({ status: 'pending' }),
      Service.countDocuments({ isActive: true }),
    ]);

    // Financial totals
    const revenueAgg = await Booking.aggregate([
      { $match: { status: { $in: ['paymentSuccess', 'accepted', 'ongoing', 'serviceCompleted', 'paymentCompleted', 'completed'] } } },
      { $group: { _id: null, totalBookingFee: { $sum: '$bookingFee' }, totalServiceRevenue: { $sum: '$totalServiceAmount' } } },
    ]);

    const totalBookingFees = revenueAgg[0]?.totalBookingFee ?? 0;
    const totalServiceVolume = revenueAgg[0]?.totalServiceRevenue ?? 0;

    // Pending withdrawal amount
    const pendingWithdrawalAmountAgg = await WithdrawalRequest.aggregate([
      { $match: { status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const pendingPayoutAmount = pendingWithdrawalAmountAgg[0]?.total ?? 0;

    // Recent 5 bookings
    const recentBookings = await Booking.find()
      .populate('customerId', 'fullName phone email')
      .populate('staffId', 'fullName phone')
      .sort({ createdAt: -1 })
      .limit(5);

    // Recent 5 pending KYC
    const pendingKycList = await StaffProfile.find({ kycStatus: 'pending' })
      .populate('userId', 'fullName phone email profilePhotoUrl createdAt')
      .sort({ updatedAt: -1 })
      .limit(5);

    res.json({
      success: true,
      stats: {
        totalCustomers,
        totalStaff,
        pendingKycCount,
        approvedStaffCount,
        totalBookings,
        ongoingBookings,
        completedBookings,
        pendingWithdrawals,
        pendingPayoutAmount,
        totalBookingFees,
        totalServiceVolume,
        servicesCount,
      },
      recentBookings,
      pendingKycList,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 3. CUSTOMER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/customers
export const getCustomers = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, isBlocked, page = 1, limit = 20 } = req.query;
    const query: any = { role: 'customer' };

    if (search) {
      const q = String(search).trim();
      query.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
        { referralCode: { $regex: q, $options: 'i' } },
      ];
    }

    if (isBlocked !== undefined && isBlocked !== 'all') {
      query.isBlocked = isBlocked === 'true';
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [customers, total] = await Promise.all([
      User.find(query)
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(query),
    ]);

    // Attach booking counts
    const customerIds = customers.map((c) => c._id);
    const bookingCounts = await Booking.aggregate([
      { $match: { customerId: { $in: customerIds } } },
      { $group: { _id: '$customerId', count: { $sum: 1 } } },
    ]);
    const countMap = new Map(bookingCounts.map((b) => [b._id.toString(), b.count]));

    const enriched = customers.map((c) => ({
      ...c.toObject(),
      totalBookings: countMap.get(c._id.toString()) || 0,
    }));

    res.json({
      success: true,
      customers: enriched,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/admin/customers/:id
export const getCustomerById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const customer = await User.findOne({ _id: req.params.id, role: 'customer' }).select('-passwordHash');
    if (!customer) {
      res.status(404).json({ success: false, message: 'Customer not found' });
      return;
    }

    const [bookings, transactions] = await Promise.all([
      Booking.find({ customerId: customer._id }).populate('staffId', 'fullName phone').sort({ createdAt: -1 }).limit(20),
      Transaction.find({ userId: customer._id }).sort({ createdAt: -1 }).limit(20),
    ]);

    res.json({
      success: true,
      customer,
      bookings,
      transactions,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 4. STAFF MANAGEMENT & KYC APPROVAL
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/staff
export const getStaff = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { search, kycStatus, isBlocked, service, page = 1, limit = 20 } = req.query;
    const userQuery: any = { role: 'staff' };

    if (search) {
      const q = String(search).trim();
      userQuery.$or = [
        { fullName: { $regex: q, $options: 'i' } },
        { phone: { $regex: q, $options: 'i' } },
        { email: { $regex: q, $options: 'i' } },
      ];
    }

    if (isBlocked !== undefined && isBlocked !== 'all') {
      userQuery.isBlocked = isBlocked === 'true';
    }

    const staffUsers = await User.find(userQuery).select('-passwordHash');
    const userIds = staffUsers.map((u) => u._id);

    const profileQuery: any = { userId: { $in: userIds } };
    if (kycStatus && kycStatus !== 'all') {
      profileQuery.kycStatus = kycStatus;
    }
    if (service && service !== 'all') {
      profileQuery.services = service;
    }

    const profiles = await StaffProfile.find(profileQuery);
    const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));

    // Match filtered results
    let matched = staffUsers
      .filter((u) => profileMap.has(u._id.toString()))
      .map((u) => {
        const p = profileMap.get(u._id.toString())!;
        return {
          ...u.toObject(),
          profile: p,
        };
      });

    const total = matched.length;
    const skip = (Number(page) - 1) * Number(limit);
    const paginated = matched.slice(skip, skip + Number(limit));

    res.json({
      success: true,
      staff: paginated,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/admin/staff/:id
export const getStaffById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: 'staff' }).select('-passwordHash');
    if (!user) {
      res.status(404).json({ success: false, message: 'Staff member not found' });
      return;
    }

    const profile = await StaffProfile.findOne({ userId: user._id });
    const [bookings, transactions] = await Promise.all([
      Booking.find({ staffId: user._id }).populate('customerId', 'fullName phone').sort({ createdAt: -1 }).limit(20),
      Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20),
    ]);

    res.json({
      success: true,
      user,
      profile,
      bookings,
      transactions,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/admin/staff/:id/kyc (Approve or Reject KYC)
export const updateStaffKyc = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { action, rejectionReason } = req.body;
    if (!['approve', 'reject'].includes(action)) {
      res.status(400).json({ success: false, message: "Action must be 'approve' or 'reject'" });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    const profile = await StaffProfile.findOne({ userId: user._id });
    if (!profile) {
      res.status(404).json({ success: false, message: 'Staff profile not found' });
      return;
    }

    if (action === 'approve') {
      profile.kycStatus = 'approved';
      profile.isKycVerified = true;
      if (profile.kyc) profile.kyc.rejectionReason = undefined;
      await profile.save();

      // Push notification & in-app record
      await Notification.create({
        userId: user._id,
        title: 'KYC Approved 🎉',
        message: 'Congratulations! Your KYC documents have been verified by SANGI Admin. You are now live and visible to customers.',
        type: 'kyc_approved',
      });

      if (user.fcmToken) {
        await sendPushNotification({
          userId: user._id.toString(),
          fcmToken: user.fcmToken,
          title: 'KYC Approved 🎉',
          body: 'Your profile is now verified and active for customer bookings!',
          type: 'kyc_approved',
        });
      }

      res.json({
        success: true,
        message: `${user.fullName}'s KYC has been successfully APPROVED.`,
        profile,
      });
    } else {
      // Reject
      profile.kycStatus = 'rejected';
      profile.isKycVerified = false;
      if (!profile.kyc) profile.kyc = {};
      profile.kyc.rejectionReason = rejectionReason || 'Documents unclear or incomplete';
      await profile.save();

      await Notification.create({
        userId: user._id,
        title: 'KYC Action Required ⚠️',
        message: `Your KYC submission was rejected: ${profile.kyc.rejectionReason}. Please re-upload verified documents in profile settings.`,
        type: 'kyc_rejected',
      });

      if (user.fcmToken) {
        await sendPushNotification({
          userId: user._id.toString(),
          fcmToken: user.fcmToken,
          title: 'KYC Action Required ⚠️',
          body: `KYC rejected: ${profile.kyc.rejectionReason}. Please check your app to re-upload.`,
          type: 'kyc_rejected',
        });
      }

      res.json({
        success: true,
        message: `${user.fullName}'s KYC has been rejected.`,
        profile,
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 5. BLOCK / UNBLOCK USERS (CUSTOMER OR STAFF)
// ══════════════════════════════════════════════════════════════════════

// PUT /api/v1/admin/users/:id/block
export const toggleBlockUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { isBlocked, reason } = req.body;
    if (typeof isBlocked !== 'boolean') {
      res.status(400).json({ success: false, message: "'isBlocked' boolean is required" });
      return;
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    if (user.role === 'admin') {
      res.status(400).json({ success: false, message: 'Cannot block administrator accounts' });
      return;
    }

    user.isBlocked = isBlocked;
    user.blockReason = isBlocked ? (reason || 'Violation of platform terms') : undefined;
    user.blockedAt = isBlocked ? new Date() : undefined;
    await user.save();

    if (isBlocked) {
      await Notification.create({
        userId: user._id,
        title: 'Account Suspended',
        message: `Your SANGI account has been blocked: ${user.blockReason}`,
        type: 'account_blocked',
      });
      if (user.fcmToken) {
        await sendPushNotification({
          userId: user._id.toString(),
          fcmToken: user.fcmToken,
          title: 'Account Suspended',
          body: `Account blocked: ${user.blockReason}`,
          type: 'account_blocked',
        });
      }
    }

    res.json({
      success: true,
      message: `User ${user.fullName} has been ${isBlocked ? 'BLOCKED' : 'UNBLOCKED'} successfully.`,
      user: {
        id: user._id,
        fullName: user.fullName,
        isBlocked: user.isBlocked,
        blockReason: user.blockReason,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 6. BOOKINGS MANAGEMENT & LIVE GPS TRACKING
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/bookings
export const getBookings = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, search, service, page = 1, limit = 20 } = req.query;
    const query: any = {};

    if (status && status !== 'all') {
      if (status === 'ongoing') {
        query.status = { $in: ['accepted', 'ongoing'] };
      } else if (status === 'upcoming') {
        query.status = { $in: ['requested', 'paymentSuccess'] };
      } else if (status === 'completed') {
        query.status = { $in: ['completed', 'serviceCompleted', 'paymentCompleted'] };
      } else if (status === 'cancelled') {
        query.status = { $in: ['cancelled', 'declined'] };
      } else {
        query.status = status;
      }
    }

    if (service && service !== 'all') {
      query.service = { $regex: String(service).trim(), $options: 'i' };
    }

    if (search) {
      const q = String(search).trim();
      query.$or = [
        { bookingNumber: { $regex: q, $options: 'i' } },
        { location: { $regex: q, $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [bookings, total] = await Promise.all([
      Booking.find(query)
        .populate('customerId', 'fullName phone email lastKnownLat lastKnownLng')
        .populate('staffId', 'fullName phone email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Booking.countDocuments(query),
    ]);

    // Attach staff live coordinates
    const staffIds = bookings.map((b) => (b.staffId as any)?._id).filter(Boolean);
    const staffProfiles = await StaffProfile.find({ userId: { $in: staffIds } }).select('userId location lastLocationUpdateAt');
    const profileMap = new Map(staffProfiles.map((p) => [p.userId.toString(), p]));

    const enriched = bookings.map((b) => {
      const staffUser = b.staffId as any;
      const staffProf = staffUser ? profileMap.get(staffUser._id?.toString()) : null;
      return {
        ...b.toObject(),
        staffLiveLocation: staffProf?.location?.coordinates
          ? {
              lng: staffProf.location.coordinates[0],
              lat: staffProf.location.coordinates[1],
              lastUpdateAt: staffProf.lastLocationUpdateAt,
            }
          : null,
      };
    });

    res.json({
      success: true,
      bookings: enriched,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/admin/bookings/:id
export const getBookingById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('customerId', 'fullName phone email lastKnownLat lastKnownLng')
      .populate('staffId', 'fullName phone email');

    if (!booking) {
      res.status(404).json({ success: false, message: 'Booking not found' });
      return;
    }

    // Attach live staff GPS
    let staffLocation = null;
    if (booking.staffId) {
      const prof = await StaffProfile.findOne({ userId: (booking.staffId as any)._id }).select('location lastLocationUpdateAt services experience rating');
      staffLocation = prof;
    }

    res.json({
      success: true,
      booking,
      staffDetails: staffLocation,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 7. SERVICES & BOOKING PRICING MANAGEMENT
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/services & GET /api/v1/services (Public)
export const getServices = async (_req: Request, res: Response): Promise<void> => {
  try {
    const services = await Service.find().sort({ sortOrder: 1, createdAt: 1 });
    res.json({ success: true, services });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// POST /api/v1/admin/services
export const createService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { slug, name, category, imageUrl, bookingFee = 30, basePrice = 299, description = '', sortOrder = 0 } = req.body;
    if (!slug || !name || !category || !imageUrl) {
      res.status(400).json({ success: false, message: 'slug, name, category, and imageUrl are required' });
      return;
    }

    const existing = await Service.findOne({ slug: slug.toLowerCase().trim() });
    if (existing) {
      res.status(400).json({ success: false, message: 'A service with this slug already exists' });
      return;
    }

    const service = await Service.create({
      slug: slug.toLowerCase().trim(),
      name: name.trim(),
      category: category.trim(),
      imageUrl: imageUrl.trim(),
      bookingFee: Number(bookingFee),
      basePrice: Number(basePrice),
      description: description.trim(),
      sortOrder: Number(sortOrder),
      isActive: true,
    });

    res.json({ success: true, message: 'Service created successfully', service });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/admin/services/:id
export const updateService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { name, category, imageUrl, bookingFee, basePrice, description, isActive, sortOrder } = req.body;
    const service = await Service.findById(req.params.id);
    if (!service) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }

    if (name) service.name = name.trim();
    if (category) service.category = category.trim();
    if (imageUrl) service.imageUrl = imageUrl.trim();
    if (bookingFee !== undefined) service.bookingFee = Number(bookingFee);
    if (basePrice !== undefined) service.basePrice = Number(basePrice);
    if (description !== undefined) service.description = description.trim();
    if (isActive !== undefined) service.isActive = Boolean(isActive);
    if (sortOrder !== undefined) service.sortOrder = Number(sortOrder);

    await service.save();
    res.json({ success: true, message: 'Service updated successfully', service });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// DELETE /api/v1/admin/services/:id
export const deleteService = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const service = await Service.findByIdAndDelete(req.params.id);
    if (!service) {
      res.status(404).json({ success: false, message: 'Service not found' });
      return;
    }
    res.json({ success: true, message: 'Service deleted successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 8. WITHDRAWAL REQUESTS & PAYOUT APPROVALS (MIN ₹100)
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/withdrawals
export const getWithdrawals = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query: any = {};
    if (status && status !== 'all') {
      query.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [withdrawals, total] = await Promise.all([
      WithdrawalRequest.find(query)
        .populate('userId', 'fullName phone email role walletBalance')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      WithdrawalRequest.countDocuments(query),
    ]);

    res.json({
      success: true,
      withdrawals,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/admin/withdrawals/:id/approve
export const approveWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { utrReference, adminNotes } = req.body;
    if (!utrReference) {
      res.status(400).json({ success: false, message: 'Bank UTR / Transaction Reference is required' });
      return;
    }

    const request = await WithdrawalRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ success: false, message: 'Withdrawal request not found' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ success: false, message: `Request is already ${request.status.toUpperCase()}` });
      return;
    }

    request.status = 'approved';
    request.utrReference = String(utrReference).trim();
    request.adminNotes = adminNotes ? String(adminNotes).trim() : undefined;
    request.processedAt = new Date();
    request.processedBy = new mongoose.Types.ObjectId(req.user!.id);
    await request.save();

    // Mark corresponding transaction completed
    await Transaction.findOneAndUpdate(
      { userId: request.userId, type: 'withdrawal', status: 'pending' },
      { status: 'completed', subtitle: `Transferred to bank. UTR: ${utrReference}` }
    );

    // Send push notification & notification document
    const user = await User.findById(request.userId);
    if (user) {
      await Notification.create({
        userId: user._id,
        title: 'Withdrawal Transferred 🏦',
        message: `₹${request.amount} has been credited to your account via IMPS/UPI. UTR: ${utrReference}`,
        type: 'withdrawal_approved',
      });

      if (user.fcmToken) {
        await sendPushNotification({
          userId: user._id.toString(),
          fcmToken: user.fcmToken,
          title: 'Withdrawal Transferred 🏦',
          body: `₹${request.amount} credited! Ref UTR: ${utrReference}`,
          type: 'withdrawal_approved',
        });
      }
    }

    res.json({
      success: true,
      message: `Withdrawal request ${request.withdrawalNumber} of ₹${request.amount} APPROVED.`,
      withdrawal: request,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// PUT /api/v1/admin/withdrawals/:id/reject
export const rejectWithdrawal = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { rejectionReason } = req.body;
    if (!rejectionReason) {
      res.status(400).json({ success: false, message: 'Rejection reason is required' });
      return;
    }

    const request = await WithdrawalRequest.findById(req.params.id);
    if (!request) {
      res.status(404).json({ success: false, message: 'Withdrawal request not found' });
      return;
    }

    if (request.status !== 'pending') {
      res.status(400).json({ success: false, message: `Request is already ${request.status.toUpperCase()}` });
      return;
    }

    request.status = 'rejected';
    request.rejectionReason = String(rejectionReason).trim();
    request.processedAt = new Date();
    request.processedBy = new mongoose.Types.ObjectId(req.user!.id);
    await request.save();

    // REFUND amount back to user's wallet
    const updatedUser = await User.findByIdAndUpdate(
      request.userId,
      { $inc: { walletBalance: request.amount } },
      { new: true }
    );

    // Record refund transaction
    await Transaction.create({
      userId: request.userId,
      title: 'Withdrawal Refund',
      subtitle: `Refunded ₹${request.amount}: ${rejectionReason}`,
      amount: request.amount,
      isCredit: true,
      type: 'refund',
      status: 'completed',
    });

    if (updatedUser) {
      await Notification.create({
        userId: updatedUser._id,
        title: 'Withdrawal Declined ⚠️',
        message: `Your withdrawal of ₹${request.amount} was declined: ${rejectionReason}. The amount has been refunded to your wallet.`,
        type: 'withdrawal_rejected',
      });

      if (updatedUser.fcmToken) {
        await sendPushNotification({
          userId: updatedUser._id.toString(),
          fcmToken: updatedUser.fcmToken,
          title: 'Withdrawal Declined ⚠️',
          body: `Withdrawal declined: ${rejectionReason}. ₹${request.amount} refunded to wallet.`,
          type: 'withdrawal_rejected',
        });
      }
    }

    res.json({
      success: true,
      message: `Withdrawal request ${request.withdrawalNumber} REJECTED and ₹${request.amount} refunded to wallet.`,
      withdrawal: request,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 9. BANK DETAILS DIRECTORY
// ══════════════════════════════════════════════════════════════════════

// GET /api/v1/admin/bank-accounts
export const getBankAccounts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const [staffProfiles, customerUsers] = await Promise.all([
      StaffProfile.find({
        $or: [
          { 'bankAccount.accountNumber': { $exists: true, $ne: '' } },
          { 'bankAccount.ifscCode': { $exists: true, $ne: '' } },
        ],
      }).populate('userId', 'fullName phone email role walletBalance isBlocked'),
      User.find({
        role: 'customer',
        $or: [
          { 'bankAccount.accountNumber': { $exists: true, $ne: '' } },
          { 'bankAccount.upiId': { $exists: true, $ne: '' } },
        ],
      }).select('fullName phone email role walletBalance isBlocked bankAccount'),
    ]);

    const accounts: any[] = [];

    // Staff accounts
    for (const sp of staffProfiles) {
      const u = sp.userId as any;
      if (!u) continue;
      accounts.push({
        id: sp._id,
        userId: u._id,
        fullName: u.fullName,
        phone: u.phone,
        email: u.email,
        role: 'staff',
        walletBalance: u.walletBalance,
        isBlocked: u.isBlocked,
        bankName: sp.bankAccount?.bankName || 'Bank',
        accountHolderName: sp.bankAccount?.accountHolderName || u.fullName,
        accountNumber: sp.bankAccount?.accountNumber || '',
        ifscCode: sp.bankAccount?.ifscCode || '',
        upiId: (sp.bankAccount as any)?.upiId || '',
        updatedAt: (sp as any).updatedAt,
      });
    }

    // Customer accounts
    for (const cu of customerUsers) {
      accounts.push({
        id: cu._id,
        userId: cu._id,
        fullName: cu.fullName,
        phone: cu.phone,
        email: cu.email,
        role: 'customer',
        walletBalance: cu.walletBalance,
        isBlocked: cu.isBlocked,
        bankName: cu.bankAccount?.bankName || 'Bank',
        accountHolderName: cu.bankAccount?.accountHolderName || cu.fullName,
        accountNumber: cu.bankAccount?.accountNumber || '',
        ifscCode: cu.bankAccount?.ifscCode || '',
        upiId: cu.bankAccount?.upiId || '',
        updatedAt: (cu as any).updatedAt,
      });
    }

    res.json({ success: true, count: accounts.length, accounts });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ══════════════════════════════════════════════════════════════════════
// 10. NOTIFICATION CENTER (PUSH & IN-APP)
// ══════════════════════════════════════════════════════════════════════

// POST /api/v1/admin/notifications/send
export const sendNotification = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { target, userId, title, message, type = 'admin_broadcast' } = req.body;

    if (!title || !message) {
      res.status(400).json({ success: false, message: 'Title and message are required' });
      return;
    }

    if (!target) {
      res.status(400).json({ success: false, message: "Target must be 'all_customers', 'all_staff', 'all_users', or 'single_user'" });
      return;
    }

    let targetUsers: IUser[] = [];

    if (target === 'single_user') {
      if (!userId) {
        res.status(400).json({ success: false, message: "userId is required when target is 'single_user'" });
        return;
      }
      const u = await User.findById(userId);
      if (!u) {
        res.status(404).json({ success: false, message: 'User not found' });
        return;
      }
      targetUsers = [u];
    } else if (target === 'all_customers') {
      targetUsers = await User.find({ role: 'customer', isBlocked: false });
    } else if (target === 'all_staff') {
      targetUsers = await User.find({ role: 'staff', isBlocked: false });
    } else if (target === 'all_users') {
      targetUsers = await User.find({ role: { $in: ['customer', 'staff'] }, isBlocked: false });
    }

    if (targetUsers.length === 0) {
      res.status(400).json({ success: false, message: 'No eligible recipients found' });
      return;
    }

    // 1. Create in-app notification records
    const notifDocs = targetUsers.map((u) => ({
      userId: u._id,
      title: title.trim(),
      message: message.trim(),
      type: type || 'admin_announcement',
      isRead: false,
    }));
    await Notification.insertMany(notifDocs);

    // 2. Dispatch FCM push to users with tokens
    let pushedCount = 0;
    for (const u of targetUsers) {
      if (u.fcmToken) {
        try {
          await sendPushNotification({
            userId: u._id.toString(),
            fcmToken: u.fcmToken,
            title: title.trim(),
            body: message.trim(),
            type: type || 'admin_announcement',
          });
          pushedCount++;
        } catch (_) {}
      }
    }

    res.json({
      success: true,
      message: `Notification delivered to ${targetUsers.length} user(s) (Push sent to ${pushedCount} active devices).`,
      totalRecipients: targetUsers.length,
      pushedCount,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// GET /api/v1/admin/notifications/history
export const getNotificationHistory = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const history = await Notification.find()
      .populate('userId', 'fullName phone email role')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, count: history.length, history });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
};

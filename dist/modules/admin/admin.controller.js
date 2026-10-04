"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNotificationHistory = exports.sendNotification = exports.getBankAccounts = exports.rejectWithdrawal = exports.approveWithdrawal = exports.getWithdrawals = exports.deleteService = exports.updateService = exports.createService = exports.getServices = exports.getBookingById = exports.getBookings = exports.toggleBlockUser = exports.updateStaffKyc = exports.getStaffById = exports.getStaff = exports.getCustomerById = exports.getCustomers = exports.getDashboardStats = exports.getAdminProfile = exports.adminLogin = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const mongoose_1 = __importDefault(require("mongoose"));
const User_1 = require("../../models/User");
const StaffProfile_1 = require("../../models/StaffProfile");
const Booking_1 = require("../../models/Booking");
const Transaction_1 = require("../../models/Transaction");
const Notification_1 = require("../../models/Notification");
const Service_1 = require("../../models/Service");
const WithdrawalRequest_1 = require("../../models/WithdrawalRequest");
const fcm_1 = require("../../utils/fcm");
// ══════════════════════════════════════════════════════════════════════
// 1. ADMIN AUTHENTICATION
// ══════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/auth/login
const adminLogin = async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            res.status(400).json({ success: false, message: 'Email and password are required' });
            return;
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
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
        const token = jsonwebtoken_1.default.sign({ id: user._id.toString(), role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' });
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Login failed' });
    }
};
exports.adminLogin = adminLogin;
// GET /api/v1/admin/auth/me
const getAdminProfile = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select('-passwordHash');
        if (!user) {
            res.status(404).json({ success: false, message: 'Admin user not found' });
            return;
        }
        res.json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getAdminProfile = getAdminProfile;
// ══════════════════════════════════════════════════════════════════════
// 2. DASHBOARD STATS
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/dashboard/stats
const getDashboardStats = async (req, res) => {
    try {
        const [totalCustomers, totalStaff, pendingKycCount, approvedStaffCount, totalBookings, ongoingBookings, completedBookings, pendingWithdrawals, servicesCount,] = await Promise.all([
            User_1.User.countDocuments({ role: 'customer' }),
            User_1.User.countDocuments({ role: 'staff' }),
            StaffProfile_1.StaffProfile.countDocuments({ kycStatus: 'pending' }),
            StaffProfile_1.StaffProfile.countDocuments({ kycStatus: 'approved' }),
            Booking_1.Booking.countDocuments(),
            Booking_1.Booking.countDocuments({ status: { $in: ['accepted', 'ongoing'] } }),
            Booking_1.Booking.countDocuments({ status: { $in: ['completed', 'serviceCompleted', 'paymentCompleted'] } }),
            WithdrawalRequest_1.WithdrawalRequest.countDocuments({ status: 'pending' }),
            Service_1.Service.countDocuments({ isActive: true }),
        ]);
        // Financial totals
        const revenueAgg = await Booking_1.Booking.aggregate([
            { $match: { status: { $in: ['paymentSuccess', 'accepted', 'ongoing', 'serviceCompleted', 'paymentCompleted', 'completed'] } } },
            { $group: { _id: null, totalBookingFee: { $sum: '$bookingFee' }, totalServiceRevenue: { $sum: '$totalServiceAmount' } } },
        ]);
        const totalBookingFees = revenueAgg[0]?.totalBookingFee ?? 0;
        const totalServiceVolume = revenueAgg[0]?.totalServiceRevenue ?? 0;
        // Pending withdrawal amount
        const pendingWithdrawalAmountAgg = await WithdrawalRequest_1.WithdrawalRequest.aggregate([
            { $match: { status: 'pending' } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const pendingPayoutAmount = pendingWithdrawalAmountAgg[0]?.total ?? 0;
        // Recent 5 bookings
        const recentBookings = await Booking_1.Booking.find()
            .populate('customerId', 'fullName phone email')
            .populate('staffId', 'fullName phone')
            .sort({ createdAt: -1 })
            .limit(5);
        // Recent 5 pending KYC
        const pendingKycList = await StaffProfile_1.StaffProfile.find({ kycStatus: 'pending' })
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getDashboardStats = getDashboardStats;
// ══════════════════════════════════════════════════════════════════════
// 3. CUSTOMER MANAGEMENT
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/customers
const getCustomers = async (req, res) => {
    try {
        const { search, isBlocked, page = 1, limit = 20 } = req.query;
        const query = { role: 'customer' };
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
            User_1.User.find(query)
                .select('-passwordHash')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            User_1.User.countDocuments(query),
        ]);
        // Attach booking counts
        const customerIds = customers.map((c) => c._id);
        const bookingCounts = await Booking_1.Booking.aggregate([
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCustomers = getCustomers;
// GET /api/v1/admin/customers/:id
const getCustomerById = async (req, res) => {
    try {
        const customer = await User_1.User.findOne({ _id: req.params.id, role: 'customer' }).select('-passwordHash');
        if (!customer) {
            res.status(404).json({ success: false, message: 'Customer not found' });
            return;
        }
        const [bookings, transactions] = await Promise.all([
            Booking_1.Booking.find({ customerId: customer._id }).populate('staffId', 'fullName phone').sort({ createdAt: -1 }).limit(20),
            Transaction_1.Transaction.find({ userId: customer._id }).sort({ createdAt: -1 }).limit(20),
        ]);
        res.json({
            success: true,
            customer,
            bookings,
            transactions,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getCustomerById = getCustomerById;
// ══════════════════════════════════════════════════════════════════════
// 4. STAFF MANAGEMENT & KYC APPROVAL
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/staff
const getStaff = async (req, res) => {
    try {
        const { search, kycStatus, isBlocked, service, page = 1, limit = 20 } = req.query;
        const userQuery = { role: 'staff' };
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
        const staffUsers = await User_1.User.find(userQuery).select('-passwordHash');
        const userIds = staffUsers.map((u) => u._id);
        const profileQuery = { userId: { $in: userIds } };
        if (kycStatus && kycStatus !== 'all') {
            profileQuery.kycStatus = kycStatus;
        }
        if (service && service !== 'all') {
            profileQuery.services = service;
        }
        const profiles = await StaffProfile_1.StaffProfile.find(profileQuery);
        const profileMap = new Map(profiles.map((p) => [p.userId.toString(), p]));
        // Match filtered results
        let matched = staffUsers
            .filter((u) => profileMap.has(u._id.toString()))
            .map((u) => {
            const p = profileMap.get(u._id.toString());
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getStaff = getStaff;
// GET /api/v1/admin/staff/:id
const getStaffById = async (req, res) => {
    try {
        const user = await User_1.User.findOne({ _id: req.params.id, role: 'staff' }).select('-passwordHash');
        if (!user) {
            res.status(404).json({ success: false, message: 'Staff member not found' });
            return;
        }
        const profile = await StaffProfile_1.StaffProfile.findOne({ userId: user._id });
        const [bookings, transactions] = await Promise.all([
            Booking_1.Booking.find({ staffId: user._id }).populate('customerId', 'fullName phone').sort({ createdAt: -1 }).limit(20),
            Transaction_1.Transaction.find({ userId: user._id }).sort({ createdAt: -1 }).limit(20),
        ]);
        res.json({
            success: true,
            user,
            profile,
            bookings,
            transactions,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getStaffById = getStaffById;
// PUT /api/v1/admin/staff/:id/kyc (Approve or Reject KYC)
const updateStaffKyc = async (req, res) => {
    try {
        const { action, rejectionReason } = req.body;
        if (!['approve', 'reject'].includes(action)) {
            res.status(400).json({ success: false, message: "Action must be 'approve' or 'reject'" });
            return;
        }
        const user = await User_1.User.findById(req.params.id);
        if (!user) {
            res.status(404).json({ success: false, message: 'User not found' });
            return;
        }
        const profile = await StaffProfile_1.StaffProfile.findOne({ userId: user._id });
        if (!profile) {
            res.status(404).json({ success: false, message: 'Staff profile not found' });
            return;
        }
        if (action === 'approve') {
            profile.kycStatus = 'approved';
            profile.isKycVerified = true;
            if (profile.kyc)
                profile.kyc.rejectionReason = undefined;
            await profile.save();
            // Push notification & in-app record
            await Notification_1.Notification.create({
                userId: user._id,
                title: 'KYC Approved 🎉',
                message: 'Congratulations! Your KYC documents have been verified by SANGI Admin. You are now live and visible to customers.',
                type: 'kyc_approved',
            });
            if (user.fcmToken) {
                await (0, fcm_1.sendPushNotification)({
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
        }
        else {
            // Reject
            profile.kycStatus = 'rejected';
            profile.isKycVerified = false;
            if (!profile.kyc)
                profile.kyc = {};
            profile.kyc.rejectionReason = rejectionReason || 'Documents unclear or incomplete';
            await profile.save();
            await Notification_1.Notification.create({
                userId: user._id,
                title: 'KYC Action Required ⚠️',
                message: `Your KYC submission was rejected: ${profile.kyc.rejectionReason}. Please re-upload verified documents in profile settings.`,
                type: 'kyc_rejected',
            });
            if (user.fcmToken) {
                await (0, fcm_1.sendPushNotification)({
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateStaffKyc = updateStaffKyc;
// ══════════════════════════════════════════════════════════════════════
// 5. BLOCK / UNBLOCK USERS (CUSTOMER OR STAFF)
// ══════════════════════════════════════════════════════════════════════
// PUT /api/v1/admin/users/:id/block
const toggleBlockUser = async (req, res) => {
    try {
        const { isBlocked, reason } = req.body;
        if (typeof isBlocked !== 'boolean') {
            res.status(400).json({ success: false, message: "'isBlocked' boolean is required" });
            return;
        }
        const user = await User_1.User.findById(req.params.id);
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
            await Notification_1.Notification.create({
                userId: user._id,
                title: 'Account Suspended',
                message: `Your SANGI account has been blocked: ${user.blockReason}`,
                type: 'account_blocked',
            });
            if (user.fcmToken) {
                await (0, fcm_1.sendPushNotification)({
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.toggleBlockUser = toggleBlockUser;
// ══════════════════════════════════════════════════════════════════════
// 6. BOOKINGS MANAGEMENT & LIVE GPS TRACKING
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/bookings
const getBookings = async (req, res) => {
    try {
        const { status, search, service, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status && status !== 'all') {
            if (status === 'ongoing') {
                query.status = { $in: ['accepted', 'ongoing'] };
            }
            else if (status === 'upcoming') {
                query.status = { $in: ['requested', 'paymentSuccess'] };
            }
            else if (status === 'completed') {
                query.status = { $in: ['completed', 'serviceCompleted', 'paymentCompleted'] };
            }
            else if (status === 'cancelled') {
                query.status = { $in: ['cancelled', 'declined'] };
            }
            else {
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
            Booking_1.Booking.find(query)
                .populate('customerId', 'fullName phone email lastKnownLat lastKnownLng')
                .populate('staffId', 'fullName phone email')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            Booking_1.Booking.countDocuments(query),
        ]);
        // Attach staff live coordinates
        const staffIds = bookings.map((b) => b.staffId?._id).filter(Boolean);
        const staffProfiles = await StaffProfile_1.StaffProfile.find({ userId: { $in: staffIds } }).select('userId location lastLocationUpdateAt');
        const profileMap = new Map(staffProfiles.map((p) => [p.userId.toString(), p]));
        const enriched = bookings.map((b) => {
            const staffUser = b.staffId;
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getBookings = getBookings;
// GET /api/v1/admin/bookings/:id
const getBookingById = async (req, res) => {
    try {
        const booking = await Booking_1.Booking.findById(req.params.id)
            .populate('customerId', 'fullName phone email lastKnownLat lastKnownLng')
            .populate('staffId', 'fullName phone email');
        if (!booking) {
            res.status(404).json({ success: false, message: 'Booking not found' });
            return;
        }
        // Attach live staff GPS
        let staffLocation = null;
        if (booking.staffId) {
            const prof = await StaffProfile_1.StaffProfile.findOne({ userId: booking.staffId._id }).select('location lastLocationUpdateAt services experience rating');
            staffLocation = prof;
        }
        res.json({
            success: true,
            booking,
            staffDetails: staffLocation,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getBookingById = getBookingById;
// ══════════════════════════════════════════════════════════════════════
// 7. SERVICES & BOOKING PRICING MANAGEMENT
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/services & GET /api/v1/services (Public)
const getServices = async (_req, res) => {
    try {
        const services = await Service_1.Service.find().sort({ sortOrder: 1, createdAt: 1 });
        res.json({ success: true, services });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getServices = getServices;
// POST /api/v1/admin/services
const createService = async (req, res) => {
    try {
        const { slug, name, category, imageUrl, bookingFee = 30, basePrice = 299, description = '', sortOrder = 0 } = req.body;
        if (!slug || !name || !category || !imageUrl) {
            res.status(400).json({ success: false, message: 'slug, name, category, and imageUrl are required' });
            return;
        }
        const existing = await Service_1.Service.findOne({ slug: slug.toLowerCase().trim() });
        if (existing) {
            res.status(400).json({ success: false, message: 'A service with this slug already exists' });
            return;
        }
        const service = await Service_1.Service.create({
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.createService = createService;
// PUT /api/v1/admin/services/:id
const updateService = async (req, res) => {
    try {
        const { name, category, imageUrl, bookingFee, basePrice, description, isActive, sortOrder } = req.body;
        const service = await Service_1.Service.findById(req.params.id);
        if (!service) {
            res.status(404).json({ success: false, message: 'Service not found' });
            return;
        }
        if (name)
            service.name = name.trim();
        if (category)
            service.category = category.trim();
        if (imageUrl)
            service.imageUrl = imageUrl.trim();
        if (bookingFee !== undefined)
            service.bookingFee = Number(bookingFee);
        if (basePrice !== undefined)
            service.basePrice = Number(basePrice);
        if (description !== undefined)
            service.description = description.trim();
        if (isActive !== undefined)
            service.isActive = Boolean(isActive);
        if (sortOrder !== undefined)
            service.sortOrder = Number(sortOrder);
        await service.save();
        res.json({ success: true, message: 'Service updated successfully', service });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.updateService = updateService;
// DELETE /api/v1/admin/services/:id
const deleteService = async (req, res) => {
    try {
        const service = await Service_1.Service.findByIdAndDelete(req.params.id);
        if (!service) {
            res.status(404).json({ success: false, message: 'Service not found' });
            return;
        }
        res.json({ success: true, message: 'Service deleted successfully' });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.deleteService = deleteService;
// ══════════════════════════════════════════════════════════════════════
// 8. WITHDRAWAL REQUESTS & PAYOUT APPROVALS (MIN ₹100)
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/withdrawals
const getWithdrawals = async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const query = {};
        if (status && status !== 'all') {
            query.status = status;
        }
        const skip = (Number(page) - 1) * Number(limit);
        const [withdrawals, total] = await Promise.all([
            WithdrawalRequest_1.WithdrawalRequest.find(query)
                .populate('userId', 'fullName phone email role walletBalance')
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),
            WithdrawalRequest_1.WithdrawalRequest.countDocuments(query),
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getWithdrawals = getWithdrawals;
// PUT /api/v1/admin/withdrawals/:id/approve
const approveWithdrawal = async (req, res) => {
    try {
        const { utrReference, adminNotes } = req.body;
        if (!utrReference) {
            res.status(400).json({ success: false, message: 'Bank UTR / Transaction Reference is required' });
            return;
        }
        const request = await WithdrawalRequest_1.WithdrawalRequest.findById(req.params.id);
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
        request.processedBy = new mongoose_1.default.Types.ObjectId(req.user.id);
        await request.save();
        // Mark corresponding transaction completed
        await Transaction_1.Transaction.findOneAndUpdate({ userId: request.userId, type: 'withdrawal', status: 'pending' }, { status: 'completed', subtitle: `Transferred to bank. UTR: ${utrReference}` });
        // Send push notification & notification document
        const user = await User_1.User.findById(request.userId);
        if (user) {
            await Notification_1.Notification.create({
                userId: user._id,
                title: 'Withdrawal Transferred 🏦',
                message: `₹${request.amount} has been credited to your account via IMPS/UPI. UTR: ${utrReference}`,
                type: 'withdrawal_approved',
            });
            if (user.fcmToken) {
                await (0, fcm_1.sendPushNotification)({
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.approveWithdrawal = approveWithdrawal;
// PUT /api/v1/admin/withdrawals/:id/reject
const rejectWithdrawal = async (req, res) => {
    try {
        const { rejectionReason } = req.body;
        if (!rejectionReason) {
            res.status(400).json({ success: false, message: 'Rejection reason is required' });
            return;
        }
        const request = await WithdrawalRequest_1.WithdrawalRequest.findById(req.params.id);
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
        request.processedBy = new mongoose_1.default.Types.ObjectId(req.user.id);
        await request.save();
        // REFUND amount back to user's wallet
        const updatedUser = await User_1.User.findByIdAndUpdate(request.userId, { $inc: { walletBalance: request.amount } }, { new: true });
        // Record refund transaction
        await Transaction_1.Transaction.create({
            userId: request.userId,
            title: 'Withdrawal Refund',
            subtitle: `Refunded ₹${request.amount}: ${rejectionReason}`,
            amount: request.amount,
            isCredit: true,
            type: 'refund',
            status: 'completed',
        });
        if (updatedUser) {
            await Notification_1.Notification.create({
                userId: updatedUser._id,
                title: 'Withdrawal Declined ⚠️',
                message: `Your withdrawal of ₹${request.amount} was declined: ${rejectionReason}. The amount has been refunded to your wallet.`,
                type: 'withdrawal_rejected',
            });
            if (updatedUser.fcmToken) {
                await (0, fcm_1.sendPushNotification)({
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.rejectWithdrawal = rejectWithdrawal;
// ══════════════════════════════════════════════════════════════════════
// 9. BANK DETAILS DIRECTORY
// ══════════════════════════════════════════════════════════════════════
// GET /api/v1/admin/bank-accounts
const getBankAccounts = async (req, res) => {
    try {
        const [staffProfiles, customerUsers] = await Promise.all([
            StaffProfile_1.StaffProfile.find({
                $or: [
                    { 'bankAccount.accountNumber': { $exists: true, $ne: '' } },
                    { 'bankAccount.ifscCode': { $exists: true, $ne: '' } },
                ],
            }).populate('userId', 'fullName phone email role walletBalance isBlocked'),
            User_1.User.find({
                role: 'customer',
                $or: [
                    { 'bankAccount.accountNumber': { $exists: true, $ne: '' } },
                    { 'bankAccount.upiId': { $exists: true, $ne: '' } },
                ],
            }).select('fullName phone email role walletBalance isBlocked bankAccount'),
        ]);
        const accounts = [];
        // Staff accounts
        for (const sp of staffProfiles) {
            const u = sp.userId;
            if (!u)
                continue;
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
                upiId: sp.bankAccount?.upiId || '',
                updatedAt: sp.updatedAt,
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
                updatedAt: cu.updatedAt,
            });
        }
        res.json({ success: true, count: accounts.length, accounts });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getBankAccounts = getBankAccounts;
// ══════════════════════════════════════════════════════════════════════
// 10. NOTIFICATION CENTER (PUSH & IN-APP)
// ══════════════════════════════════════════════════════════════════════
// POST /api/v1/admin/notifications/send
const sendNotification = async (req, res) => {
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
        let targetUsers = [];
        if (target === 'single_user') {
            if (!userId) {
                res.status(400).json({ success: false, message: "userId is required when target is 'single_user'" });
                return;
            }
            const u = await User_1.User.findById(userId);
            if (!u) {
                res.status(404).json({ success: false, message: 'User not found' });
                return;
            }
            targetUsers = [u];
        }
        else if (target === 'all_customers') {
            targetUsers = await User_1.User.find({ role: 'customer', isBlocked: false });
        }
        else if (target === 'all_staff') {
            targetUsers = await User_1.User.find({ role: 'staff', isBlocked: false });
        }
        else if (target === 'all_users') {
            targetUsers = await User_1.User.find({ role: { $in: ['customer', 'staff'] }, isBlocked: false });
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
        await Notification_1.Notification.insertMany(notifDocs);
        // 2. Dispatch FCM push to users with tokens
        let pushedCount = 0;
        for (const u of targetUsers) {
            if (u.fcmToken) {
                try {
                    await (0, fcm_1.sendPushNotification)({
                        userId: u._id.toString(),
                        fcmToken: u.fcmToken,
                        title: title.trim(),
                        body: message.trim(),
                        type: type || 'admin_announcement',
                    });
                    pushedCount++;
                }
                catch (_) { }
            }
        }
        res.json({
            success: true,
            message: `Notification delivered to ${targetUsers.length} user(s) (Push sent to ${pushedCount} active devices).`,
            totalRecipients: targetUsers.length,
            pushedCount,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.sendNotification = sendNotification;
// GET /api/v1/admin/notifications/history
const getNotificationHistory = async (req, res) => {
    try {
        const history = await Notification_1.Notification.find()
            .populate('userId', 'fullName phone email role')
            .sort({ createdAt: -1 })
            .limit(50);
        res.json({ success: true, count: history.length, history });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
exports.getNotificationHistory = getNotificationHistory;
//# sourceMappingURL=admin.controller.js.map
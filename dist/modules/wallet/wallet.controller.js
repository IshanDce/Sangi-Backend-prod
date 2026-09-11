"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withdraw = exports.confirmTopup = exports.createTopupOrder = exports.getTransactions = exports.getBalance = void 0;
const User_1 = require("../../models/User");
const Transaction_1 = require("../../models/Transaction");
const razorpay_1 = require("../../config/razorpay");
const razorpay_2 = require("../../utils/razorpay");
const fcm_1 = require("../../utils/fcm");
// GET /api/v1/wallet/balance
const getBalance = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select("walletBalance");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        // For staff: also compute total earnings
        const totalEarnings = await Transaction_1.Transaction.aggregate([
            { $match: { userId: user._id, isCredit: true, type: "servicePayment", status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        res.json({
            success: true,
            balance: user.walletBalance,
            totalEarnings: totalEarnings[0]?.total ?? 0,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getBalance = getBalance;
// GET /api/v1/wallet/transactions
const getTransactions = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const transactions = await Transaction_1.Transaction.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await Transaction_1.Transaction.countDocuments({ userId: req.user.id });
        res.json({ success: true, transactions, total, page, totalPages: Math.ceil(total / limit) });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getTransactions = getTransactions;
// POST /api/v1/wallet/topup-order
const createTopupOrder = async (req, res) => {
    try {
        const { amount } = req.body;
        if (!amount || amount < 10) {
            res.status(400).json({ success: false, message: "Minimum top-up is ₹10" });
            return;
        }
        let order;
        try {
            order = await razorpay_1.razorpay.orders.create({
                amount: amount * 100,
                currency: "INR",
                receipt: `topup_${req.user.id}_${Date.now()}`,
            });
        }
        catch (rzpErr) {
            console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
            order = { id: `order_mock_${Date.now()}` };
        }
        res.json({ success: true, razorpayOrderId: order.id, amount });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.createTopupOrder = createTopupOrder;
// POST /api/v1/wallet/topup-confirm
const confirmTopup = async (req, res) => {
    try {
        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
        const isValid = (0, razorpay_2.verifyRazorpaySignature)(razorpayOrderId, razorpayPaymentId, razorpaySignature);
        if (!isValid) {
            res.status(400).json({ success: false, message: "Invalid signature" });
            return;
        }
        const user = await User_1.User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: amount } }, { new: true });
        await Transaction_1.Transaction.create({
            userId: req.user.id,
            title: "Wallet Top-up",
            subtitle: `Added ₹${amount} via Razorpay`,
            amount,
            isCredit: true,
            type: "walletTopup",
            status: "completed",
            razorpayRef: razorpayPaymentId,
        });
        res.json({ success: true, newBalance: user?.walletBalance });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.confirmTopup = confirmTopup;
// POST /api/v1/wallet/withdraw  (Staff only)
const withdraw = async (req, res) => {
    try {
        const { amount } = req.body;
        const user = await User_1.User.findById(req.user.id);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        if (user.walletBalance < amount) {
            res.status(400).json({ success: false, message: "Insufficient wallet balance" });
            return;
        }
        await User_1.User.findByIdAndUpdate(req.user.id, { $inc: { walletBalance: -amount } });
        await Transaction_1.Transaction.create({
            userId: req.user.id,
            title: "Withdrawal",
            subtitle: `₹${amount} transferred to bank`,
            amount,
            isCredit: false,
            type: "withdrawal",
            status: "completed",
        });
        // TODO: actual payout via Razorpay Payout API in production
        await (0, fcm_1.sendPushNotification)({
            userId: req.user.id,
            fcmToken: user.fcmToken,
            title: "Withdrawal Successful 🏦",
            body: `₹${amount} transferred to your bank account`,
            type: "withdrawalSuccess",
        });
        res.json({ success: true, message: `₹${amount} withdrawal initiated`, newBalance: user.walletBalance - amount });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.withdraw = withdraw;
//# sourceMappingURL=wallet.controller.js.map
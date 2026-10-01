"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateReferralCode = exports.getMyReferral = void 0;
const User_1 = require("../../models/User");
const Referral_1 = require("../../models/Referral");
const Transaction_1 = require("../../models/Transaction");
// GET /api/v1/referral/me — Get my referral code + stats
const getMyReferral = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select("referralCode referralCount");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        // Total earned from referrals
        const totalEarned = await Transaction_1.Transaction.aggregate([
            { $match: { userId: user._id, type: "referral", status: "completed" } },
            { $group: { _id: null, total: { $sum: "$amount" } } },
        ]);
        // Recent referrals
        const referrals = await Referral_1.Referral.find({ referrerId: user._id, status: "completed" })
            .sort({ createdAt: -1 })
            .limit(50)
            .populate("refereeId", "fullName role createdAt");
        const referralList = referrals.map((r) => {
            const referee = r.refereeId;
            return {
                name: referee?.fullName ?? "Unknown",
                role: referee?.role ?? "unknown",
                date: r.createdAt,
                reward: r.rewardAmount,
            };
        });
        res.json({
            success: true,
            referralCode: user.referralCode,
            referralCount: user.referralCount,
            totalEarned: totalEarned[0]?.total ?? 0,
            referrals: referralList,
        });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getMyReferral = getMyReferral;
// POST /api/v1/referral/validate — Validate a referral code (public, pre-registration)
const validateReferralCode = async (req, res) => {
    try {
        const { code } = req.body;
        if (!code) {
            res.status(400).json({ success: false, message: "code is required" });
            return;
        }
        const user = await User_1.User.findOne({ referralCode: code.trim().toUpperCase() }).select("fullName");
        if (!user) {
            res.json({ success: false, valid: false, message: "Invalid referral code" });
            return;
        }
        // Mask name for privacy: "Ishan S."
        const parts = (user.fullName || "").split(" ");
        const maskedName = parts.length > 1
            ? `${parts[0]} ${parts[parts.length - 1][0]}.`
            : parts[0];
        res.json({ success: true, valid: true, referrerName: maskedName });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.validateReferralCode = validateReferralCode;
//# sourceMappingURL=referral.controller.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.processReferral = processReferral;
const User_1 = require("../models/User");
const Referral_1 = require("../models/Referral");
const Transaction_1 = require("../models/Transaction");
const Notification_1 = require("../models/Notification");
const mongoose_1 = __importDefault(require("mongoose"));
const REFERRAL_REWARD = 50; // ₹50
/**
 * Process a referral code after a new user registers.
 * - Validates the code
 * - Credits ₹50 to the referrer's wallet
 * - Creates Transaction + Referral records
 * - Sends notification to referrer
 */
async function processReferral(newUserId, referralCode, newUserPhone) {
    try {
        if (!referralCode || !referralCode.trim()) {
            return { success: false, message: "No referral code provided" };
        }
        const code = referralCode.trim().toUpperCase();
        // Find referrer
        const referrer = await User_1.User.findOne({ referralCode: code });
        if (!referrer) {
            return { success: false, message: "Invalid referral code" };
        }
        // Self-referral check
        if (String(referrer._id) === newUserId || referrer.phone === newUserPhone) {
            return { success: false, message: "Cannot use your own referral code" };
        }
        // Check if this new user already used a referral (idempotent)
        const existing = await Referral_1.Referral.findOne({ refereeId: newUserId });
        if (existing) {
            return { success: false, message: "Referral already applied" };
        }
        // Monthly cap check (max 50 referrals/month)
        const monthStart = new Date();
        monthStart.setDate(1);
        monthStart.setHours(0, 0, 0, 0);
        const monthlyCount = await Referral_1.Referral.countDocuments({
            referrerId: referrer._id,
            status: "completed",
            createdAt: { $gte: monthStart },
        });
        if (monthlyCount >= 50) {
            return { success: false, message: "Referrer has reached monthly referral limit" };
        }
        // Credit referrer wallet
        await User_1.User.updateOne({ _id: referrer._id }, { $inc: { walletBalance: REFERRAL_REWARD, referralCount: 1 } });
        // Set referredBy on new user
        await User_1.User.updateOne({ _id: newUserId }, { referredBy: referrer._id });
        // Create transaction
        await Transaction_1.Transaction.create({
            userId: referrer._id,
            title: "Referral Reward",
            subtitle: "Someone joined using your referral code",
            amount: REFERRAL_REWARD,
            isCredit: true,
            type: "referral",
            status: "completed",
        });
        // Create referral record
        await Referral_1.Referral.create({
            referrerId: referrer._id,
            refereeId: new mongoose_1.default.Types.ObjectId(newUserId),
            referralCode: code,
            rewardAmount: REFERRAL_REWARD,
            status: "completed",
            creditedAt: new Date(),
        });
        // Send notification to referrer
        const newUser = await User_1.User.findById(newUserId).select("fullName");
        await Notification_1.Notification.create({
            userId: referrer._id,
            title: "Referral Reward! 🎉",
            message: `₹${REFERRAL_REWARD} credited! ${newUser?.fullName ?? "Someone"} joined SANGI using your referral code.`,
            type: "referral",
        });
        return { success: true, message: "Referral reward credited" };
    }
    catch (err) {
        console.error("processReferral error:", err);
        return { success: false, message: String(err) };
    }
}
//# sourceMappingURL=referral.js.map
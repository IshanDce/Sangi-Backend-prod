import { User } from "../models/User";
import { Referral } from "../models/Referral";
import { Transaction } from "../models/Transaction";
import { Notification } from "../models/Notification";
import mongoose from "mongoose";

const REFERRAL_REWARD = 50; // ₹50

/**
 * Process a referral code after a new user registers.
 * - Validates the code
 * - Credits ₹50 to the referrer's wallet
 * - Creates Transaction + Referral records
 * - Sends notification to referrer
 */
export async function processReferral(
  newUserId: string,
  referralCode: string,
  newUserPhone: string
): Promise<{ success: boolean; message: string }> {
  try {
    if (!referralCode || !referralCode.trim()) {
      return { success: false, message: "No referral code provided" };
    }

    const code = referralCode.trim().toUpperCase();

    // Find referrer
    const referrer = await User.findOne({ referralCode: code });
    if (!referrer) {
      return { success: false, message: "Invalid referral code" };
    }

    // Self-referral check
    if (String(referrer._id) === newUserId || referrer.phone === newUserPhone) {
      return { success: false, message: "Cannot use your own referral code" };
    }

    // Check if this new user already used a referral (idempotent)
    const existing = await Referral.findOne({ refereeId: newUserId });
    if (existing) {
      return { success: false, message: "Referral already applied" };
    }

    // Monthly cap check (max 50 referrals/month)
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthlyCount = await Referral.countDocuments({
      referrerId: referrer._id,
      status: "completed",
      createdAt: { $gte: monthStart },
    });
    if (monthlyCount >= 50) {
      return { success: false, message: "Referrer has reached monthly referral limit" };
    }

    // Credit referrer wallet
    await User.updateOne(
      { _id: referrer._id },
      { $inc: { walletBalance: REFERRAL_REWARD, referralCount: 1 } }
    );

    // Set referredBy on new user
    await User.updateOne(
      { _id: newUserId },
      { referredBy: referrer._id }
    );

    // Create transaction
    await Transaction.create({
      userId: referrer._id,
      title: "Referral Reward",
      subtitle: "Someone joined using your referral code",
      amount: REFERRAL_REWARD,
      isCredit: true,
      type: "referral",
      status: "completed",
    });

    // Create referral record
    await Referral.create({
      referrerId: referrer._id,
      refereeId: new mongoose.Types.ObjectId(newUserId),
      referralCode: code,
      rewardAmount: REFERRAL_REWARD,
      status: "completed",
      creditedAt: new Date(),
    });

    // Send notification to referrer
    const newUser = await User.findById(newUserId).select("fullName");
    await Notification.create({
      userId: referrer._id,
      title: "Referral Reward! 🎉",
      message: `₹${REFERRAL_REWARD} credited! ${newUser?.fullName ?? "Someone"} joined SANGI using your referral code.`,
      type: "referral",
    });

    return { success: true, message: "Referral reward credited" };
  } catch (err) {
    console.error("processReferral error:", err);
    return { success: false, message: String(err) };
  }
}

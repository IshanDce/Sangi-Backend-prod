import { Request, Response } from "express";
import { User } from "../../models/User";
import { Referral } from "../../models/Referral";
import { Transaction } from "../../models/Transaction";
import { AuthRequest } from "../../middleware/auth";

// GET /api/v1/referral/me — Get my referral code + stats
export const getMyReferral = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select("referralCode referralCount");
    if (!user) { res.status(404).json({ success: false, message: "User not found" }); return; }

    // Total earned from referrals
    const totalEarned = await Transaction.aggregate([
      { $match: { userId: user._id, type: "referral", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Recent referrals
    const referrals = await Referral.find({ referrerId: user._id, status: "completed" })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate("refereeId", "fullName role createdAt");

    const referralList = referrals.map((r) => {
      const referee = r.refereeId as any;
      return {
        name: referee?.fullName ?? "Unknown",
        role: referee?.role ?? "unknown",
        date: (r as any).createdAt,
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
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/referral/validate — Validate a referral code (public, pre-registration)
export const validateReferralCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code } = req.body;
    if (!code) { res.status(400).json({ success: false, message: "code is required" }); return; }

    const user = await User.findOne({ referralCode: code.trim().toUpperCase() }).select("fullName");
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
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

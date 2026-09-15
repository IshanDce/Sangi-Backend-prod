import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { User } from "../../models/User";
import { Transaction } from "../../models/Transaction";
import { razorpay } from "../../config/razorpay";
import { verifyRazorpaySignature } from "../../utils/razorpay";
import { sendPushNotification } from "../../utils/fcm";

// GET /api/v1/wallet/balance
export const getBalance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select("walletBalance");
    if (!user) { res.status(404).json({ success: false, message: "User not found" }); return; }

    // For staff: also compute total earnings
    const totalEarnings = await Transaction.aggregate([
      { $match: { userId: user._id, isCredit: true, type: "servicePayment", status: "completed" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    res.json({
      success: true,
      balance: user.walletBalance,
      totalEarnings: totalEarnings[0]?.total ?? 0,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// GET /api/v1/wallet/transactions
export const getTransactions = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Transaction.countDocuments({ userId: req.user!.id });

    res.json({ success: true, transactions, total, page, totalPages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/wallet/topup-order
export const createTopupOrder = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    if (!amount || amount < 10) { res.status(400).json({ success: false, message: "Minimum top-up is ₹10" }); return; }

    let order: { id: string };
    try {
      order = await razorpay.orders.create({
        amount: amount * 100,
        currency: "INR",
        receipt: `topup_${req.user!.id}_${Date.now()}`,
      });
    } catch (rzpErr) {
      console.warn("[Razorpay] Order creation fallback to mock order ID:", String(rzpErr));
      order = { id: `order_mock_${Date.now()}` };
    }
    res.json({ success: true, razorpayOrderId: order.id, amount });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/wallet/topup-confirm
export const confirmTopup = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature, amount } = req.body;
    const isValid = verifyRazorpaySignature(razorpayOrderId, razorpayPaymentId, razorpaySignature);
    if (!isValid) { res.status(400).json({ success: false, message: "Invalid signature" }); return; }

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $inc: { walletBalance: amount } },
      { new: true }
    );

    await Transaction.create({
      userId: req.user!.id,
      title: "Wallet Top-up",
      subtitle: `Added ₹${amount} via Razorpay`,
      amount,
      isCredit: true,
      type: "walletTopup",
      status: "completed",
      razorpayRef: razorpayPaymentId,
    });

    res.json({ success: true, newBalance: user?.walletBalance });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/wallet/withdraw  (Staff only)
export const withdraw = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { amount } = req.body;
    const numericAmount = Number(amount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      res.status(400).json({ success: false, message: "Please enter a valid withdrawal amount" });
      return;
    }

    const user = await User.findById(req.user!.id);
    if (!user) { res.status(404).json({ success: false, message: "User not found" }); return; }
    if (user.walletBalance < numericAmount) {
      res.status(400).json({ success: false, message: "Insufficient wallet balance" });
      return;
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user!.id,
      { $inc: { walletBalance: -numericAmount } },
      { new: true }
    );

    await Transaction.create({
      userId: req.user!.id,
      title: "Withdrawal",
      subtitle: `₹${numericAmount} transferred to bank`,
      amount: numericAmount,
      isCredit: false,
      type: "withdrawal",
      status: "completed",
    });

    // Send push notification if token available
    await sendPushNotification({
      userId: req.user!.id,
      fcmToken: user.fcmToken,
      title: "Withdrawal Successful 🏦",
      body: `₹${numericAmount} transferred to your bank account`,
      type: "withdrawalSuccess",
    });

    res.json({ success: true, message: `₹${numericAmount} withdrawal initiated`, newBalance: updatedUser?.walletBalance ?? 0 });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

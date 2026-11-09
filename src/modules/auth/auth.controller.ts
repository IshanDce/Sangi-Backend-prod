import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../../models/User";
import { processReferral } from "../../helpers/referral";
import { Otp } from "../../models/Otp";
import { generateOtp, sendOtpSms } from "../../utils/otp";
import { AuthRequest } from "../../middleware/auth";

const signToken = (id: string, role: string) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any });

// ─── Play Store Reviewer & Testing Bypass Configuration ───
// These numbers bypass dynamic SMS generation and accept STATIC_TEST_OTP
const PLAY_STORE_TEST_PHONES = new Set(["9876543210", "8888888888", "9999911111", "9999999999"]);
const STATIC_TEST_OTP = "123456";

// POST /api/v1/auth/send-otp
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, purpose, role } = req.body;
    if (!phone || !purpose) {
      res.status(400).json({ success: false, message: "phone and purpose required" });
      return;
    }

    // Role-based login verification
    if (purpose === "login") {
      const user = await User.findOne({ phone });
      if (!user) {
        res.status(404).json({
          success: false,
          errorCode: "USER_NOT_FOUND",
          message: "No account found with this phone number. Please register first.",
        });
        return;
      }

      if (user.isBlocked) {
        res.status(403).json({
          success: false,
          isBlocked: true,
          message: user.blockReason
            ? `Your account has been blocked: ${user.blockReason}`
            : "Your account has been blocked by administrator.",
        });
        return;
      }

      if (role && user.role !== role) {
        const isStaff = user.role === "staff";
        res.status(403).json({
          success: false,
          errorCode: "ROLE_MISMATCH",
          registeredRole: user.role,
          message: isStaff
            ? "This phone number is registered as a Service Partner. Please switch to the Partner Login tab."
            : "This phone number is registered as a Customer. Please switch to the Customer Login tab.",
        });
        return;
      }
    }

    // Forgot password: phone must be registered
    if (purpose === "forgot_password") {
      const user = await User.findOne({ phone });
      if (!user) {
        res.status(404).json({
          success: false,
          errorCode: "USER_NOT_FOUND",
          message: "No account found with this phone number.",
        });
        return;
      }
    }

    await Otp.deleteMany({ phone });
    const isTestPhone = PLAY_STORE_TEST_PHONES.has(phone);
    const otp = isTestPhone ? STATIC_TEST_OTP : generateOtp();
    const expiresAt = new Date(Date.now() + (isTestPhone ? 60 : 10) * 60 * 1000);
    await Otp.create({ phone, otp, purpose, expiresAt });

    // Send OTP via Linerpay SMS (or console log in mock mode; bypass for reviewers)
    if (!isTestPhone) {
      await sendOtpSms(phone, otp);
    } else {
      console.log(`[PLAY-STORE-BYPASS] Static OTP '${STATIC_TEST_OTP}' generated for test phone ${phone}`);
    }

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/verify-otp
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, role } = req.body;
    const isTestPhone = PLAY_STORE_TEST_PHONES.has(phone);

    let record = null;
    if (isTestPhone && otp === STATIC_TEST_OTP) {
      record = { phone, otp };
    } else {
      record = await Otp.findOne({ phone, otp });
    }

    if (!record) {
      res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      return;
    }

    const user = await User.findOne({ phone });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found. Please register first." });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        isBlocked: true,
        message: user.blockReason
          ? `Your account has been blocked: ${user.blockReason}`
          : "Your account has been blocked by administrator.",
      });
      return;
    }

    if (role && user.role !== role) {
      const isStaff = user.role === "staff";
      res.status(403).json({
        success: false,
        errorCode: "ROLE_MISMATCH",
        registeredRole: user.role,
        message: isStaff
          ? "This account is registered as a Service Partner. Please login through the Partner Login tab."
          : "This account is registered as a Customer. Please login through the Customer Login tab.",
      });
      return;
    }

    await Otp.deleteOne({ _id: record._id });
    user.isPhoneVerified = true;
    await user.save();

    const token = signToken(String(user._id), user.role);
    res.json({
      success: true,
      accessToken: token,
      user: { id: user._id, role: user.role, fullName: user.fullName, profilePhotoUrl: user.profilePhotoUrl },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password, role } = req.body;
    const user = await User.findOne({ phone });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: "Invalid phone or password" });
      return;
    }

    if (user.isBlocked) {
      res.status(403).json({
        success: false,
        isBlocked: true,
        message: user.blockReason
          ? `Your account has been blocked: ${user.blockReason}`
          : "Your account has been blocked by administrator.",
      });
      return;
    }

    if (role && user.role !== role) {
      const isStaff = user.role === "staff";
      res.status(403).json({
        success: false,
        errorCode: "ROLE_MISMATCH",
        registeredRole: user.role,
        message: isStaff
          ? "This account is registered as a Service Partner. Please login through the Partner Login tab."
          : "This account is registered as a Customer. Please login through the Customer Login tab.",
      });
      return;
    }

    const token = signToken(String(user._id), user.role);
    res.json({
      success: true,
      accessToken: token,
      user: { id: user._id, role: user.role, fullName: user.fullName, profilePhotoUrl: user.profilePhotoUrl },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/register/customer
export const registerCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { fullName, email, phone, password, referralCode } = req.body;
    const existing = await User.findOne({ $or: [{ phone }, { email }] });
    if (existing) {
      res.status(409).json({ success: false, message: "Phone or email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, email, phone, passwordHash, role: "customer" });

    // Process referral if a code was provided
    if (referralCode) {
      await processReferral(String(user._id), referralCode, phone);
    }

    res.status(201).json({ success: true, message: "Registered. Please verify OTP.", userId: user._id });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/forgot-password/verify-otp
// Verifies OTP and returns a short-lived reset token (no JWT login)
export const verifyForgotOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;
    if (!phone || !otp) {
      res.status(400).json({ success: false, message: "phone and otp required" });
      return;
    }

    const isTestPhone = PLAY_STORE_TEST_PHONES.has(phone);
    let record: any = null;
    if (isTestPhone && otp === STATIC_TEST_OTP) {
      record = { phone, otp, expiresAt: new Date(Date.now() + 60000) };
    } else {
      record = await Otp.findOne({ phone, otp, purpose: "forgot_password" });
    }

    if (!record) {
      res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      return;
    }

    if (record.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: record._id });
      res.status(400).json({ success: false, message: "OTP has expired. Please request a new one." });
      return;
    }

    await Otp.deleteOne({ _id: record._id });

    // Issue a short-lived reset token (5 minutes)
    const resetToken = jwt.sign({ phone, purpose: "reset_password" }, process.env.JWT_SECRET!, { expiresIn: "5m" });
    res.json({ success: true, resetToken });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/reset-password
// Resets password using the short-lived reset token
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resetToken, newPassword } = req.body;
    if (!resetToken || !newPassword) {
      res.status(400).json({ success: false, message: "resetToken and newPassword required" });
      return;
    }
    if (newPassword.length < 6) {
      res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      return;
    }

    let payload: any;
    try {
      payload = jwt.verify(resetToken, process.env.JWT_SECRET!);
    } catch {
      res.status(401).json({ success: false, message: "Reset link has expired. Please try again." });
      return;
    }

    if (payload?.purpose !== "reset_password") {
      res.status(401).json({ success: false, message: "Invalid reset token" });
      return;
    }

    const user = await User.findOne({ phone: payload.phone });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found" });
      return;
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.json({ success: true, message: "Password reset successfully. Please login with your new password." });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/logout
export const logout = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, message: "Logged out successfully" });
};

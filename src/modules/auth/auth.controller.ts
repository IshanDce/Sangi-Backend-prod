import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../../models/User";
import { Otp } from "../../models/Otp";
import { generateOtp, sendOtpSms } from "../../utils/otp";
import { AuthRequest } from "../../middleware/auth";

const signToken = (id: string, role: string) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any });

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
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
    await Otp.create({ phone, otp, purpose, expiresAt });

    // Send OTP via Linerpay SMS (or console log in mock mode)
    await sendOtpSms(phone, otp);

    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/verify-otp
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp, role } = req.body;
    const record = await Otp.findOne({ phone, otp });
    if (!record) {
      res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      return;
    }

    const user = await User.findOne({ phone });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found. Please register first." });
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
    const { fullName, email, phone, password } = req.body;
    const existing = await User.findOne({ $or: [{ phone }, { email }] });
    if (existing) {
      res.status(409).json({ success: false, message: "Phone or email already registered" });
      return;
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ fullName, email, phone, passwordHash, role: "customer" });
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

    const record = await Otp.findOne({ phone, otp, purpose: "forgot_password" });
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

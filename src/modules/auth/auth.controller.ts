import { Request, Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../../models/User";
import { Otp } from "../../models/Otp";
import { generateOtp } from "../../utils/otp";
import { AuthRequest } from "../../middleware/auth";

const signToken = (id: string, role: string) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET!, { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") as any });

// POST /api/v1/auth/send-otp
export const sendOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, purpose } = req.body;
    if (!phone || !purpose) {
      res.status(400).json({ success: false, message: "phone and purpose required" });
      return;
    }
    await Otp.deleteMany({ phone });
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
    await Otp.create({ phone, otp, purpose, expiresAt });
    // In production: send via MSG91 / Fast2SMS
    console.log(`[OTP] phone=${phone} otp=${otp}`);
    res.json({ success: true, message: "OTP sent successfully" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// POST /api/v1/auth/verify-otp
export const verifyOtp = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, otp } = req.body;
    const record = await Otp.findOne({ phone, otp });
    if (!record) {
      res.status(400).json({ success: false, message: "Invalid or expired OTP" });
      return;
    }
    await Otp.deleteOne({ _id: record._id });
    const user = await User.findOneAndUpdate({ phone }, { isPhoneVerified: true }, { new: true });
    if (!user) {
      res.status(404).json({ success: false, message: "User not found. Please register first." });
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

// POST /api/v1/auth/login
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ success: false, message: "Invalid phone or password" });
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

// POST /api/v1/auth/logout
export const logout = async (_req: AuthRequest, res: Response): Promise<void> => {
  res.json({ success: true, message: "Logged out successfully" });
};

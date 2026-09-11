"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logout = exports.registerCustomer = exports.login = exports.verifyOtp = exports.sendOtp = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../../models/User");
const Otp_1 = require("../../models/Otp");
const otp_1 = require("../../utils/otp");
const signToken = (id, role) => jsonwebtoken_1.default.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: (process.env.JWT_EXPIRES_IN || "7d") });
// POST /api/v1/auth/send-otp
const sendOtp = async (req, res) => {
    try {
        const { phone, purpose } = req.body;
        if (!phone || !purpose) {
            res.status(400).json({ success: false, message: "phone and purpose required" });
            return;
        }
        await Otp_1.Otp.deleteMany({ phone });
        const otp = (0, otp_1.generateOtp)();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min TTL
        await Otp_1.Otp.create({ phone, otp, purpose, expiresAt });
        // In production: send via MSG91 / Fast2SMS
        console.log(`[OTP] phone=${phone} otp=${otp}`);
        res.json({ success: true, message: "OTP sent successfully" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.sendOtp = sendOtp;
// POST /api/v1/auth/verify-otp
const verifyOtp = async (req, res) => {
    try {
        const { phone, otp } = req.body;
        const record = await Otp_1.Otp.findOne({ phone, otp });
        if (!record) {
            res.status(400).json({ success: false, message: "Invalid or expired OTP" });
            return;
        }
        await Otp_1.Otp.deleteOne({ _id: record._id });
        const user = await User_1.User.findOneAndUpdate({ phone }, { isPhoneVerified: true }, { new: true });
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.verifyOtp = verifyOtp;
// POST /api/v1/auth/login
const login = async (req, res) => {
    try {
        const { phone, password } = req.body;
        const user = await User_1.User.findOne({ phone });
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
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.login = login;
// POST /api/v1/auth/register/customer
const registerCustomer = async (req, res) => {
    try {
        const { fullName, email, phone, password } = req.body;
        const existing = await User_1.User.findOne({ $or: [{ phone }, { email }] });
        if (existing) {
            res.status(409).json({ success: false, message: "Phone or email already registered" });
            return;
        }
        const passwordHash = await bcryptjs_1.default.hash(password, 12);
        const user = await User_1.User.create({ fullName, email, phone, passwordHash, role: "customer" });
        res.status(201).json({ success: true, message: "Registered. Please verify OTP.", userId: user._id });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.registerCustomer = registerCustomer;
// POST /api/v1/auth/logout
const logout = async (_req, res) => {
    res.json({ success: true, message: "Logged out successfully" });
};
exports.logout = logout;
//# sourceMappingURL=auth.controller.js.map
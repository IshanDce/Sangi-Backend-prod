"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = exports.requireRole = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = require("../models/User");
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Check if user is blocked (skip check for admin role)
        if (decoded.role !== 'admin') {
            const userDoc = await User_1.User.findById(decoded.id).select('isBlocked blockReason');
            if (userDoc?.isBlocked) {
                res.status(403).json({
                    success: false,
                    isBlocked: true,
                    message: userDoc.blockReason
                        ? `Your account has been blocked: ${userDoc.blockReason}`
                        : 'Your account has been blocked by administrator.',
                });
                return;
            }
        }
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }
};
exports.protect = protect;
const requireRole = (...roles) => (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    next();
};
exports.requireRole = requireRole;
const requireAdmin = (req, res, next) => {
    if (req.user?.role !== 'admin') {
        res.status(403).json({ success: false, message: 'Forbidden. Admin access required.' });
        return;
    }
    next();
};
exports.requireAdmin = requireAdmin;
//# sourceMappingURL=auth.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.protect = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ success: false, message: 'Unauthorized' });
        return;
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    }
    catch {
        res.status(401).json({ success: false, message: 'Token invalid or expired' });
    }
};
exports.protect = protect;
const requireRole = (role) => (req, res, next) => {
    if (req.user?.role !== role) {
        res.status(403).json({ success: false, message: 'Forbidden' });
        return;
    }
    next();
};
exports.requireRole = requireRole;
//# sourceMappingURL=auth.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.markAllRead = exports.markRead = exports.getNotifications = void 0;
const Notification_1 = require("../../models/Notification");
const mongoose_1 = __importDefault(require("mongoose"));
// GET /api/v1/notifications
const getNotifications = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const userId = new mongoose_1.default.Types.ObjectId(req.user.id);
        const [notifications, unreadCount] = await Promise.all([
            Notification_1.Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
            Notification_1.Notification.countDocuments({ userId, isRead: false }),
        ]);
        res.json({ success: true, notifications, unreadCount, page });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getNotifications = getNotifications;
// PUT /api/v1/notifications/:id/read
const markRead = async (req, res) => {
    try {
        await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true });
        res.json({ success: true });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.markRead = markRead;
// PUT /api/v1/notifications/read-all
const markAllRead = async (req, res) => {
    try {
        await Notification_1.Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        res.json({ success: true, message: "All notifications marked as read" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.markAllRead = markAllRead;
//# sourceMappingURL=notifications.controller.js.map
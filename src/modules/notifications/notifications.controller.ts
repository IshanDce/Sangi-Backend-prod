import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { Notification } from "../../models/Notification";
import mongoose from "mongoose";

// GET /api/v1/notifications
export const getNotifications = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;

    const userId = new mongoose.Types.ObjectId(req.user!.id);

    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit),
      Notification.countDocuments({ userId, isRead: false }),
    ]);

    res.json({ success: true, notifications, unreadCount, page });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// PUT /api/v1/notifications/:id/read
export const markRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user!.id },
      { isRead: true }
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// PUT /api/v1/notifications/read-all
export const markAllRead = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Notification.updateMany({ userId: req.user!.id, isRead: false }, { isRead: true });
    res.json({ success: true, message: "All notifications marked as read" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

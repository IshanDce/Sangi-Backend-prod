import { Response } from "express";
import { AuthRequest } from "../../middleware/auth";
import { User } from "../../models/User";
import { imagekit } from "../../config/imagekit";

// GET /api/v1/users/me
export const getMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user!.id).select("-passwordHash");
    if (!user) { res.status(404).json({ success: false, message: "User not found" }); return; }
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// PUT /api/v1/users/me
export const updateMe = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fullName, email } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { fullName, email },
      { new: true }
    ).select("-passwordHash");
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// PUT /api/v1/users/me/photo  (multipart form-data: photo)
export const updatePhoto = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    if (!req.file) { res.status(400).json({ success: false, message: "No photo uploaded" }); return; }

    const fileBase64 = req.file.buffer.toString("base64");
    const uploadRes = await imagekit.upload({
      file: fileBase64,
      fileName: `profile_${req.user!.id}_${Date.now()}.jpg`,
      folder: "/sangi/profiles/",
    });

    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { profilePhotoUrl: uploadRes.url },
      { new: true }
    ).select("-passwordHash");

    res.json({ success: true, profilePhotoUrl: uploadRes.url, user });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

// PUT /api/v1/users/me/fcm-token
export const updateFcmToken = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { fcmToken } = req.body;
    await User.findByIdAndUpdate(req.user!.id, { fcmToken });
    res.json({ success: true, message: "FCM token updated" });
  } catch (err) {
    res.status(500).json({ success: false, message: String(err) });
  }
};

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateFcmToken = exports.updatePhoto = exports.updateMe = exports.getMe = void 0;
const User_1 = require("../../models/User");
const imagekit_1 = require("../../config/imagekit");
// GET /api/v1/users/me
const getMe = async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select("-passwordHash");
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        res.json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.getMe = getMe;
// PUT /api/v1/users/me
const updateMe = async (req, res) => {
    try {
        const { fullName, email } = req.body;
        const user = await User_1.User.findByIdAndUpdate(req.user.id, { fullName, email }, { new: true }).select("-passwordHash");
        res.json({ success: true, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateMe = updateMe;
// PUT /api/v1/users/me/photo  (multipart form-data: photo)
const updatePhoto = async (req, res) => {
    try {
        if (!req.file) {
            res.status(400).json({ success: false, message: "No photo uploaded" });
            return;
        }
        const fileBase64 = req.file.buffer.toString("base64");
        const uploadRes = await imagekit_1.imagekit.upload({
            file: fileBase64,
            fileName: `profile_${req.user.id}_${Date.now()}.jpg`,
            folder: "/sangi/profiles/",
        });
        const user = await User_1.User.findByIdAndUpdate(req.user.id, { profilePhotoUrl: uploadRes.url }, { new: true }).select("-passwordHash");
        res.json({ success: true, profilePhotoUrl: uploadRes.url, user });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updatePhoto = updatePhoto;
// PUT /api/v1/users/me/fcm-token
const updateFcmToken = async (req, res) => {
    try {
        const { fcmToken } = req.body;
        await User_1.User.findByIdAndUpdate(req.user.id, { fcmToken });
        res.json({ success: true, message: "FCM token updated" });
    }
    catch (err) {
        res.status(500).json({ success: false, message: String(err) });
    }
};
exports.updateFcmToken = updateFcmToken;
//# sourceMappingURL=users.controller.js.map
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const firebase_1 = require("../config/firebase");
const Notification_1 = require("../models/Notification");
const mongoose_1 = __importDefault(require("mongoose"));
const sendPushNotification = async (payload) => {
    // Always save notification in DB
    await Notification_1.Notification.create({
        userId: new mongoose_1.default.Types.ObjectId(payload.userId),
        title: payload.title,
        message: payload.body,
        type: payload.type,
        metadata: payload.metadata ?? undefined,
    });
    // Send FCM only if FCM token exists
    if (!payload.fcmToken)
        return;
    try {
        const messaging = (0, firebase_1.getMessaging)();
        if (!messaging)
            return; // Firebase not configured yet
        await messaging.send({
            token: payload.fcmToken,
            notification: { title: payload.title, body: payload.body },
            data: {
                type: payload.type,
                ...(payload.metadata ? { meta: JSON.stringify(payload.metadata) } : {}),
            },
            android: { priority: 'high' },
            apns: { payload: { aps: { sound: 'default' } } },
        });
    }
    catch (err) {
        console.error('FCM send failed:', err);
    }
};
exports.sendPushNotification = sendPushNotification;
//# sourceMappingURL=fcm.js.map
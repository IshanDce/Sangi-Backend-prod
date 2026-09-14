"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPushNotification = void 0;
const firebase_1 = require("../config/firebase");
const Notification_1 = require("../models/Notification");
const User_1 = require("../models/User");
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
        const isUnregistered = err?.code === 'messaging/registration-token-not-registered' ||
            err?.code === 'messaging/invalid-registration-token' ||
            err?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
            err?.message?.includes('NotRegistered') ||
            err?.message?.includes('UNREGISTERED') ||
            err?.cause?.response?.status === 404;
        if (isUnregistered) {
            console.warn(`[FCM] Stale/unregistered token for user ${payload.userId} detected. Clearing token from DB.`);
            try {
                await User_1.User.findByIdAndUpdate(payload.userId, { $unset: { fcmToken: 1 } });
            }
            catch (dbErr) {
                console.error('[FCM] Failed to clear stale token from user document:', dbErr);
            }
        }
        else {
            console.error('FCM send failed:', err);
        }
    }
};
exports.sendPushNotification = sendPushNotification;
//# sourceMappingURL=fcm.js.map
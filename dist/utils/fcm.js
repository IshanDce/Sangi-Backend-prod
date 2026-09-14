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
    console.log(`[FCM] 🔔 sendPushNotification called — userId=${payload.userId} type=${payload.type} title="${payload.title}"`);
    console.log(`[FCM] 🔑 fcmToken=${payload.fcmToken ? payload.fcmToken.substring(0, 30) + '...' : '(NULL/EMPTY — notification will NOT be sent)'}`);
    // Always save notification in DB
    try {
        await Notification_1.Notification.create({
            userId: new mongoose_1.default.Types.ObjectId(payload.userId),
            title: payload.title,
            message: payload.body,
            type: payload.type,
            metadata: payload.metadata ?? undefined,
        });
        console.log(`[FCM] ✅ Notification saved to DB for userId=${payload.userId}`);
    }
    catch (dbErr) {
        console.error(`[FCM] ❌ Failed to save notification to DB:`, dbErr);
    }
    // Send FCM only if FCM token exists
    if (!payload.fcmToken) {
        console.warn(`[FCM] ⚠️  No fcmToken for userId=${payload.userId} — skipping push. User needs to login on device to register token.`);
        return;
    }
    try {
        const messaging = (0, firebase_1.getMessaging)();
        if (!messaging) {
            console.error('[FCM] ❌ Firebase messaging not initialized — check service account credentials on VPS');
            return;
        }
        console.log(`[FCM] 🚀 Sending push to token ${payload.fcmToken.substring(0, 30)}...`);
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
        console.log(`[FCM] ✅✅ Push notification SENT successfully to userId=${payload.userId}`);
    }
    catch (err) {
        const isUnregistered = err?.code === 'messaging/registration-token-not-registered' ||
            err?.code === 'messaging/invalid-registration-token' ||
            err?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
            err?.message?.includes('NotRegistered') ||
            err?.message?.includes('UNREGISTERED') ||
            err?.cause?.response?.status === 404;
        if (isUnregistered) {
            console.warn(`[FCM] ⚠️  Stale/unregistered token for userId=${payload.userId}. Token has expired. Clearing from DB.`);
            try {
                await User_1.User.findByIdAndUpdate(payload.userId, { $unset: { fcmToken: 1 } });
                console.log(`[FCM] ✅ Stale token cleared from DB for userId=${payload.userId}`);
            }
            catch (dbErr) {
                console.error('[FCM] Failed to clear stale token:', dbErr);
            }
        }
        else {
            console.error(`[FCM] ❌ Push send FAILED for userId=${payload.userId}:`, err?.message || err);
            console.error(`[FCM] Error code: ${err?.code} | errorInfo: ${JSON.stringify(err?.errorInfo)}`);
        }
    }
};
exports.sendPushNotification = sendPushNotification;
//# sourceMappingURL=fcm.js.map
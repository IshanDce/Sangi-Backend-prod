import { getMessaging } from '../config/firebase';
import { Notification } from '../models/Notification';
import { User } from '../models/User';
import mongoose from 'mongoose';

interface PushPayload {
  userId: string;
  fcmToken: string | undefined | null;
  title: string;
  body: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export const sendPushNotification = async (payload: PushPayload): Promise<void> => {
  console.log(`[FCM] 🔔 sendPushNotification called — userId=${payload.userId} type=${payload.type} title="${payload.title}"`);
  console.log(`[FCM] 🔑 fcmToken=${payload.fcmToken ? payload.fcmToken.substring(0, 30) + '...' : '(NULL/EMPTY — notification will NOT be sent)'}`);

  // Always save notification in DB
  try {
    await Notification.create({
      userId: new mongoose.Types.ObjectId(payload.userId),
      title: payload.title,
      message: payload.body,
      type: payload.type,
      metadata: payload.metadata ?? undefined,
    });
    console.log(`[FCM] ✅ Notification saved to DB for userId=${payload.userId}`);
  } catch (dbErr) {
    console.error(`[FCM] ❌ Failed to save notification to DB:`, dbErr);
  }

  // Send FCM only if FCM token exists
  if (!payload.fcmToken) {
    console.warn(`[FCM] ⚠️  No fcmToken for userId=${payload.userId} — skipping push. User needs to login on device to register token.`);
    return;
  }

  try {
    const messaging = getMessaging();
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
  } catch (err: any) {
    const isUnregistered =
      err?.code === 'messaging/registration-token-not-registered' ||
      err?.code === 'messaging/invalid-registration-token' ||
      err?.errorInfo?.code === 'messaging/registration-token-not-registered' ||
      err?.message?.includes('NotRegistered') ||
      err?.message?.includes('UNREGISTERED') ||
      err?.cause?.response?.status === 404;

    if (isUnregistered) {
      console.warn(`[FCM] ⚠️  Stale/unregistered token for userId=${payload.userId}. Token has expired. Clearing from DB.`);
      try {
        await User.findByIdAndUpdate(payload.userId, { $unset: { fcmToken: 1 } });
        console.log(`[FCM] ✅ Stale token cleared from DB for userId=${payload.userId}`);
      } catch (dbErr) {
        console.error('[FCM] Failed to clear stale token:', dbErr);
      }
    } else {
      console.error(`[FCM] ❌ Push send FAILED for userId=${payload.userId}:`, err?.message || err);
      console.error(`[FCM] Error code: ${err?.code} | errorInfo: ${JSON.stringify(err?.errorInfo)}`);
    }
  }
};

import { getMessaging } from '../config/firebase';
import { Notification } from '../models/Notification';
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
  // Always save notification in DB
  await Notification.create({
    userId: new mongoose.Types.ObjectId(payload.userId),
    title: payload.title,
    message: payload.body,
    type: payload.type,
    metadata: payload.metadata ?? undefined,
  });

  // Send FCM only if FCM token exists
  if (!payload.fcmToken) return;

  try {
    const messaging = getMessaging();
    if (!messaging) return; // Firebase not configured yet
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
  } catch (err) {
    console.error('FCM send failed:', err);
  }
};

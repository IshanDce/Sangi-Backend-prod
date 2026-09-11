import { initializeApp, getApps, cert, getApp, applicationDefault } from 'firebase-admin/app';
import { getMessaging as _getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';
import * as path from 'path';

let firebaseConfigured = false;

if (getApps().length === 0) {
  // Strategy 1: GOOGLE_APPLICATION_CREDENTIALS env var (path to JSON file)
  const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if (credPath && fs.existsSync(credPath)) {
    try {
      const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
      initializeApp({ credential: cert(serviceAccount) });
      firebaseConfigured = true;
      console.log('[Firebase] ✅ Initialized from service account JSON file');
    } catch (err) {
      console.error('[Firebase] ❌ Failed to init from JSON file:', err);
    }
  }

  // Strategy 2: Individual env vars as fallback
  if (
    !firebaseConfigured &&
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY &&
    !process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_KEY_HERE')
  ) {
    try {
      initializeApp({
        credential: cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
      firebaseConfigured = true;
      console.log('[Firebase] ✅ Initialized from individual env vars');
    } catch (err) {
      console.error('[Firebase] ❌ Failed to init from env vars:', err);
    }
  }

  if (!firebaseConfigured) {
    console.warn('[Firebase] ⚠️  Not configured — push notifications will be skipped');
  }
}

export const getMessaging = () => {
  if (!firebaseConfigured) {
    console.warn('[FCM] Firebase not configured — notifications skipped');
    return null;
  }
  return _getMessaging(getApp());
};


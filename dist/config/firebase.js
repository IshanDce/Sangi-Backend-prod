"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMessaging = void 0;
const app_1 = require("firebase-admin/app");
const messaging_1 = require("firebase-admin/messaging");
const fs = __importStar(require("fs"));
let firebaseConfigured = false;
if ((0, app_1.getApps)().length === 0) {
    // Strategy 1: GOOGLE_APPLICATION_CREDENTIALS env var (path to JSON file)
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (credPath && fs.existsSync(credPath)) {
        try {
            const serviceAccount = JSON.parse(fs.readFileSync(credPath, 'utf8'));
            (0, app_1.initializeApp)({ credential: (0, app_1.cert)(serviceAccount) });
            firebaseConfigured = true;
            console.log('[Firebase] ✅ Initialized from service account JSON file');
        }
        catch (err) {
            console.error('[Firebase] ❌ Failed to init from JSON file:', err);
        }
    }
    // Strategy 2: Individual env vars as fallback
    if (!firebaseConfigured &&
        process.env.FIREBASE_PROJECT_ID &&
        process.env.FIREBASE_CLIENT_EMAIL &&
        process.env.FIREBASE_PRIVATE_KEY &&
        !process.env.FIREBASE_PRIVATE_KEY.includes('YOUR_KEY_HERE')) {
        try {
            (0, app_1.initializeApp)({
                credential: (0, app_1.cert)({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
                }),
            });
            firebaseConfigured = true;
            console.log('[Firebase] ✅ Initialized from individual env vars');
        }
        catch (err) {
            console.error('[Firebase] ❌ Failed to init from env vars:', err);
        }
    }
    if (!firebaseConfigured) {
        console.warn('[Firebase] ⚠️  Not configured — push notifications will be skipped');
    }
}
const getMessaging = () => {
    if (!firebaseConfigured) {
        console.warn('[FCM] Firebase not configured — notifications skipped');
        return null;
    }
    return (0, messaging_1.getMessaging)((0, app_1.getApp)());
};
exports.getMessaging = getMessaging;
//# sourceMappingURL=firebase.js.map
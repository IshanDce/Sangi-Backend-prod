interface PushPayload {
    userId: string;
    fcmToken: string | undefined | null;
    title: string;
    body: string;
    type: string;
    metadata?: Record<string, unknown>;
}
export declare const sendPushNotification: (payload: PushPayload) => Promise<void>;
export {};

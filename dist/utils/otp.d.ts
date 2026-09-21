export declare const generateOtp: () => string;
/**
 * Sends OTP via Linerpay SMS gateway.
 * Falls back to console log in development / if API key is missing.
 */
export declare const sendOtpSms: (phone: string, otp: string) => Promise<void>;

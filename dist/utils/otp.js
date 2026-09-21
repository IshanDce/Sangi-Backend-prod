"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendOtpSms = exports.generateOtp = void 0;
const https_1 = __importDefault(require("https"));
const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOtp = generateOtp;
/**
 * Sends OTP via Linerpay SMS gateway.
 * Falls back to console log in development / if API key is missing.
 */
const sendOtpSms = async (phone, otp) => {
    const apiKey = process.env.LINERPAY_API_KEY;
    const mode = process.env.OTP_MODE ?? "mock";
    if (mode !== "live" || !apiKey) {
        console.log(`[OTP-MOCK] phone=${phone}  otp=${otp}`);
        return;
    }
    const message = encodeURIComponent(`Your SANGI OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`);
    const url = `https://api.linerpay.in/api/otp.php?api_key=${apiKey}&numbers=${phone}&Message=${message}`;
    return new Promise((resolve, reject) => {
        https_1.default.get(url, (res) => {
            let body = "";
            res.on("data", (chunk) => (body += chunk));
            res.on("end", () => {
                try {
                    const json = JSON.parse(body);
                    if (json.status_code === "200") {
                        console.log(`[OTP-LIVE] Sent to ${phone} — status: ${json.status}`);
                        resolve();
                    }
                    else {
                        console.error(`[OTP-LIVE] Failed for ${phone}:`, json);
                        // Don't reject — OTP is still saved in DB; dev can read from logs
                        resolve();
                    }
                }
                catch (e) {
                    console.error("[OTP-LIVE] Parse error:", e, body);
                    resolve(); // Non-fatal
                }
            });
        }).on("error", (err) => {
            console.error("[OTP-LIVE] Network error:", err.message);
            resolve(); // Non-fatal — OTP still in DB
        });
    });
};
exports.sendOtpSms = sendOtpSms;
//# sourceMappingURL=otp.js.map
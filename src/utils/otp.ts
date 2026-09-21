import https from "https";

export const generateOtp = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

/**
 * Sends OTP via Linerpay SMS gateway.
 * Falls back to console log in development / if API key is missing.
 */
export const sendOtpSms = async (phone: string, otp: string): Promise<void> => {
  const apiKey = process.env.LINERPAY_API_KEY;
  const mode   = process.env.OTP_MODE ?? "mock";

  if (mode !== "live" || !apiKey) {
    console.log(`[OTP-MOCK] phone=${phone}  otp=${otp}`);
    return;
  }

  const message = encodeURIComponent(`Your SANGI OTP is ${otp}. Valid for 10 minutes. Do not share it with anyone.`);
  const url = `https://api.linerpay.in/api/otp.php?api_key=${apiKey}&numbers=${phone}&Message=${message}`;

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(body);
          if (json.status_code === "200") {
            console.log(`[OTP-LIVE] Sent to ${phone} — status: ${json.status}`);
            resolve();
          } else {
            console.error(`[OTP-LIVE] Failed for ${phone}:`, json);
            // Don't reject — OTP is still saved in DB; dev can read from logs
            resolve();
          }
        } catch (e) {
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

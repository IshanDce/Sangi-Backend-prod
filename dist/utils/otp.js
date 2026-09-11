"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtp = void 0;
const generateOtp = () => {
    const mode = process.env.OTP_MODE ?? 'mock';
    if (mode === 'mock')
        return '123456';
    // TODO: integrate MSG91 here when OTP_MODE=live
    return Math.floor(100000 + Math.random() * 900000).toString();
};
exports.generateOtp = generateOtp;
//# sourceMappingURL=otp.js.map
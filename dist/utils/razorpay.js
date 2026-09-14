"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyRazorpaySignature = exports.isMockOrderId = exports.isMockMode = void 0;
const crypto_1 = __importDefault(require("crypto"));
/**
 * True when Razorpay API access is not available — orders will be issued
 * as `order_mock_*` IDs and signature verification is bypassed so the
 * customer flow can be tested end-to-end without real Razorpay keys.
 *
 * Set RAZORPAY_MOCK_MODE=true in .env to force mock mode.
 * It also auto-engages when the Razorpay SDK throws on order creation.
 */
const isMockMode = () => process.env.RAZORPAY_MOCK_MODE === 'true';
exports.isMockMode = isMockMode;
const isMockOrderId = (orderId) => typeof orderId === 'string' && orderId.startsWith('order_mock_');
exports.isMockOrderId = isMockOrderId;
const verifyRazorpaySignature = (orderId, paymentId, signature) => {
    // Mock orders bypass signature verification
    if ((0, exports.isMockOrderId)(orderId)) {
        console.log('[Razorpay] Mock order detected — skipping signature verification');
        return true;
    }
    const body = `${orderId}|${paymentId}`;
    const expected = crypto_1.default
        .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(body)
        .digest('hex');
    return expected === signature;
};
exports.verifyRazorpaySignature = verifyRazorpaySignature;
//# sourceMappingURL=razorpay.js.map
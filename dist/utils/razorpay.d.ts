/**
 * True when Razorpay API access is not available — orders will be issued
 * as `order_mock_*` IDs and signature verification is bypassed so the
 * customer flow can be tested end-to-end without real Razorpay keys.
 *
 * Set RAZORPAY_MOCK_MODE=true in .env to force mock mode.
 * It also auto-engages when the Razorpay SDK throws on order creation.
 */
export declare const isMockMode: () => boolean;
export declare const isMockOrderId: (orderId?: string) => boolean;
export declare const verifyRazorpaySignature: (orderId?: string, paymentId?: string, signature?: string) => boolean;

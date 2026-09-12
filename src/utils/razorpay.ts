import crypto from 'crypto';

/**
 * True when Razorpay API access is not available — orders will be issued
 * as `order_mock_*` IDs and signature verification is bypassed so the
 * customer flow can be tested end-to-end without real Razorpay keys.
 *
 * Set RAZORPAY_MOCK_MODE=true in .env to force mock mode.
 * It also auto-engages when the Razorpay SDK throws on order creation.
 */
export const isMockMode = (): boolean =>
  process.env.RAZORPAY_MOCK_MODE === 'true';

export const isMockOrderId = (orderId: string): boolean =>
  typeof orderId === 'string' && orderId.startsWith('order_mock_');

export const verifyRazorpaySignature = (
  orderId: string,
  paymentId: string,
  signature: string
): boolean => {
  // Mock orders bypass signature verification
  if (isMockOrderId(orderId)) {
    console.log('[Razorpay] Mock order detected — skipping signature verification');
    return true;
  }

  const body = `${orderId}|${paymentId}`;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(body)
    .digest('hex');
  return expected === signature;
};

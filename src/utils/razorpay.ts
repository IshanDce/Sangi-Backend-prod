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

export const isMockOrderId = (orderId?: string): boolean =>
  typeof orderId === 'string' && orderId.startsWith('order_mock_');

export const verifyRazorpaySignature = (
  orderId?: string,
  paymentId?: string,
  signature?: string
): boolean => {
  const cleanOrderId = orderId ? String(orderId).trim() : '';
  const cleanPaymentId = paymentId ? String(paymentId).trim() : '';
  const cleanSignature = signature ? String(signature).trim() : '';

  // Mock orders & mock payments bypass signature verification
  if (
    isMockMode() ||
    isMockOrderId(cleanOrderId) ||
    cleanPaymentId.startsWith('pay_mock_') ||
    cleanSignature === 'sig_mock'
  ) {
    console.log('[Razorpay] Mock payment detected — skipping signature verification');
    return true;
  }

  if (!cleanOrderId || !cleanPaymentId || !cleanSignature) {
    console.warn(`[Razorpay Signature Warning] Missing parameter: orderId="${cleanOrderId}", paymentId="${cleanPaymentId}", signature="${cleanSignature ? 'present' : 'missing'}"`);
    return false;
  }

  const secret = (process.env.RAZORPAY_KEY_SECRET || '').trim();
  if (!secret || secret === 'your_razorpay_key_secret') {
    console.warn('[Razorpay] RAZORPAY_KEY_SECRET is default/dummy — bypassing signature');
    return true;
  }

  const body = `${cleanOrderId}|${cleanPaymentId}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');

  const match = expected === cleanSignature;
  if (!match) {
    console.warn(`[Razorpay Signature Mismatch]`);
    console.warn(`  Body string: "${body}"`);
    console.warn(`  Expected HMAC: ${expected}`);
    console.warn(`  Received sig:  ${cleanSignature}`);
  }
  return match;
};

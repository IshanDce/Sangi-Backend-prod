/**
 * Process a referral code after a new user registers.
 * - Validates the code
 * - Credits ₹50 to the referrer's wallet
 * - Creates Transaction + Referral records
 * - Sends notification to referrer
 */
export declare function processReferral(newUserId: string, referralCode: string, newUserPhone: string): Promise<{
    success: boolean;
    message: string;
}>;

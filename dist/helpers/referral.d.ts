/**
 * Process a referral code after a new user registers.
 * - Validates the code
 * - Credits ₹15 to the referrer's wallet
 * - Creates Transaction + Referral records
 * - Sends in-app and push notification to referrer
 */
export declare function processReferral(newUserId: string, referralCode: string, newUserPhone: string): Promise<{
    success: boolean;
    message: string;
}>;

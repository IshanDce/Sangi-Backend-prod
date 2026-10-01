import { Router } from "express";
import { getMyReferral, validateReferralCode } from "./referral.controller";
import { protect } from "../../middleware/auth";

const router = Router();

// Public — validate code before registration
router.post("/validate", validateReferralCode);

// Protected — get my referral info
router.get("/me", protect, getMyReferral);

export default router;

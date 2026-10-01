"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const referral_controller_1 = require("./referral.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
// Public — validate code before registration
router.post("/validate", referral_controller_1.validateReferralCode);
// Protected — get my referral info
router.get("/me", auth_1.protect, referral_controller_1.getMyReferral);
exports.default = router;
//# sourceMappingURL=referral.routes.js.map
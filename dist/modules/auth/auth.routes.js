"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("./auth.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.post("/send-otp", auth_controller_1.sendOtp);
router.post("/verify-otp", auth_controller_1.verifyOtp);
router.post("/login", auth_controller_1.login);
router.post("/register/customer", auth_controller_1.registerCustomer);
router.post("/logout", auth_1.protect, auth_controller_1.logout);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map
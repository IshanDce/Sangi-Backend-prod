import { Router } from "express";
import { sendOtp, verifyOtp, login, registerCustomer, logout } from "./auth.controller";
import { protect } from "../../middleware/auth";

const router = Router();

router.post("/send-otp", sendOtp);
router.post("/verify-otp", verifyOtp);
router.post("/login", login);
router.post("/register/customer", registerCustomer);
router.post("/logout", protect, logout);

export default router;

import { Router } from "express";
import { razorpayWebhook } from "./webhooks.controller";
import express from "express";

const router = Router();

// Raw body needed for Razorpay signature verification
router.post("/razorpay", express.raw({ type: "application/json" }), razorpayWebhook);

export default router;

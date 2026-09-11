"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const webhooks_controller_1 = require("./webhooks.controller");
const express_2 = __importDefault(require("express"));
const router = (0, express_1.Router)();
// Raw body needed for Razorpay signature verification
router.post("/razorpay", express_2.default.raw({ type: "application/json" }), webhooks_controller_1.razorpayWebhook);
exports.default = router;
//# sourceMappingURL=webhooks.routes.js.map
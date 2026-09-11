"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const wallet_controller_1 = require("./wallet.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get("/balance", wallet_controller_1.getBalance);
router.get("/transactions", wallet_controller_1.getTransactions);
router.post("/topup-order", (0, auth_1.requireRole)("customer"), wallet_controller_1.createTopupOrder);
router.post("/topup-confirm", (0, auth_1.requireRole)("customer"), wallet_controller_1.confirmTopup);
router.post("/withdraw", (0, auth_1.requireRole)("staff"), wallet_controller_1.withdraw);
exports.default = router;
//# sourceMappingURL=wallet.routes.js.map
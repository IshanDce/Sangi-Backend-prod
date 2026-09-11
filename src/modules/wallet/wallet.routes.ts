import { Router } from "express";
import { getBalance, getTransactions, createTopupOrder, confirmTopup, withdraw } from "./wallet.controller";
import { protect, requireRole } from "../../middleware/auth";

const router = Router();

router.use(protect);

router.get("/balance", getBalance);
router.get("/transactions", getTransactions);
router.post("/topup-order", requireRole("customer"), createTopupOrder);
router.post("/topup-confirm", requireRole("customer"), confirmTopup);
router.post("/withdraw", requireRole("staff"), withdraw);

export default router;

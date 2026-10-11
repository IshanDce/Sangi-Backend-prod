import { Router } from "express";
import { getBalance, getTransactions, createTopupOrder, confirmTopup, withdraw } from "./wallet.controller";
import { protect } from "../../middleware/auth";

const router = Router();

router.use(protect);

router.get("/balance", getBalance);
router.get("/transactions", getTransactions);
router.post("/topup-order", createTopupOrder);
router.post("/topup-confirm", confirmTopup);
router.post("/withdraw", withdraw);

export default router;

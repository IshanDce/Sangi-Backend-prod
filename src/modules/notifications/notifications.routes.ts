import { Router } from "express";
import { getNotifications, markRead, markAllRead } from "./notifications.controller";
import { protect } from "../../middleware/auth";

const router = Router();

router.use(protect);

router.get("/", getNotifications);
router.put("/read-all", markAllRead);
router.put("/:id/read", markRead);

export default router;

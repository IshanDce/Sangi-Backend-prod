import { Router } from "express";
import { getMe, updateMe, updatePhoto, updateFcmToken } from "./users.controller";
import { protect } from "../../middleware/auth";
import { upload } from "../../middleware/upload";

const router = Router();

router.use(protect);

router.get("/me", getMe);
router.put("/me", updateMe);
router.put("/me/photo", upload.single("photo"), updatePhoto);
router.put("/me/fcm-token", updateFcmToken);

export default router;

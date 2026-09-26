import { Router } from "express";
import {
  registerStep1, registerStep2Services, registerStep3Availability, registerStep4Kyc,
  searchStaff, getStaffProfile, getMyProfile, updateMyProfile, updateMyServices, updateMyAvailability,
  updateBankAccount, updateMyLocation,
  uploadPortfolio, deletePortfolioImage,
} from "./staff.controller";

import { protect, requireRole } from "../../middleware/auth";
import { upload } from "../../middleware/upload";

const router = Router();

// Public
router.post("/register/step1", registerStep1);
router.get("/search", protect, searchStaff);

// Staff-only (Must be defined BEFORE /:staffId/profile)
router.put("/register/step2-services", protect, requireRole("staff"), registerStep2Services);
router.put("/register/step3-availability", protect, requireRole("staff"), registerStep3Availability);
router.post(
  "/register/step4-kyc",
  protect,
  requireRole("staff"),
  upload.fields([{ name: "aadhaarFront" }, { name: "aadhaarBack" }, { name: "panCard" }]),
  registerStep4Kyc
);
router.get("/me/profile", protect, requireRole("staff"), getMyProfile);
router.put("/me/profile", protect, requireRole("staff"), updateMyProfile);
router.put("/me/services", protect, requireRole("staff"), updateMyServices);
router.put("/me/availability", protect, requireRole("staff"), updateMyAvailability);
router.put("/me/bank-account", protect, requireRole("staff"), updateBankAccount);
router.put("/me/location", protect, requireRole("staff"), updateMyLocation);

router.post("/me/portfolio", protect, requireRole("staff"), upload.array("images", 5), uploadPortfolio);
router.delete("/me/portfolio/:imageIndex", protect, requireRole("staff"), deletePortfolioImage);

// Parameterized staff profile route (must come after /me/*)
router.get("/:staffId/profile", protect, getStaffProfile);

export default router;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const staff_controller_1 = require("./staff.controller");
const auth_1 = require("../../middleware/auth");
const upload_1 = require("../../middleware/upload");
const router = (0, express_1.Router)();
// Public
router.post("/register/step1", staff_controller_1.registerStep1);
router.get("/search", auth_1.protect, staff_controller_1.searchStaff);
// Staff-only (Must be defined BEFORE /:staffId/profile)
router.put("/register/step2-services", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.registerStep2Services);
router.put("/register/step3-availability", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.registerStep3Availability);
router.post("/register/step4-kyc", auth_1.protect, (0, auth_1.requireRole)("staff"), upload_1.upload.fields([{ name: "aadhaarFront" }, { name: "aadhaarBack" }, { name: "panCard" }]), staff_controller_1.registerStep4Kyc);
router.get("/me/profile", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.getMyProfile);
router.put("/me/profile", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.updateMyProfile);
router.put("/me/services", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.updateMyServices);
router.put("/me/availability", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.updateMyAvailability);
router.put("/me/bank-account", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.updateBankAccount);
router.put("/me/location", auth_1.protect, (0, auth_1.requireRole)("staff"), staff_controller_1.updateMyLocation);
// Parameterized staff profile route (must come after /me/*)
router.get("/:staffId/profile", auth_1.protect, staff_controller_1.getStaffProfile);
exports.default = router;
//# sourceMappingURL=staff.routes.js.map
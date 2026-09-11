"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const users_controller_1 = require("./users.controller");
const auth_1 = require("../../middleware/auth");
const upload_1 = require("../../middleware/upload");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get("/me", users_controller_1.getMe);
router.put("/me", users_controller_1.updateMe);
router.put("/me/photo", upload_1.upload.single("photo"), users_controller_1.updatePhoto);
router.put("/me/fcm-token", users_controller_1.updateFcmToken);
exports.default = router;
//# sourceMappingURL=users.routes.js.map
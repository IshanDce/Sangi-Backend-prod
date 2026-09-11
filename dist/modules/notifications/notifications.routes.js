"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const notifications_controller_1 = require("./notifications.controller");
const auth_1 = require("../../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.protect);
router.get("/", notifications_controller_1.getNotifications);
router.put("/read-all", notifications_controller_1.markAllRead);
router.put("/:id/read", notifications_controller_1.markRead);
exports.default = router;
//# sourceMappingURL=notifications.routes.js.map
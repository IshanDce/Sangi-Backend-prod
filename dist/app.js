"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const db_1 = require("./config/db");
const errorHandler_1 = require("./middleware/errorHandler");
const auth_routes_1 = __importDefault(require("./modules/auth/auth.routes"));
const users_routes_1 = __importDefault(require("./modules/users/users.routes"));
const staff_routes_1 = __importDefault(require("./modules/staff/staff.routes"));
const bookings_routes_1 = __importDefault(require("./modules/bookings/bookings.routes"));
const wallet_routes_1 = __importDefault(require("./modules/wallet/wallet.routes"));
const notifications_routes_1 = __importDefault(require("./modules/notifications/notifications.routes"));
const webhooks_routes_1 = __importDefault(require("./modules/webhooks/webhooks.routes"));
const app = (0, express_1.default)();
// ─── Security & Parsing ───
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)({ origin: "*", credentials: true }));
// Webhook must use raw body BEFORE express.json()
app.use("/api/v1/webhook", webhooks_routes_1.default);
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// ─── Routes ───
app.use("/api/v1/auth", auth_routes_1.default);
app.use("/api/v1/users", users_routes_1.default);
app.use("/api/v1/staff", staff_routes_1.default);
app.use("/api/v1/bookings", bookings_routes_1.default);
app.use("/api/v1/wallet", wallet_routes_1.default);
app.use("/api/v1/notifications", notifications_routes_1.default);
// ─── Health Check ───
app.get("/health", (_req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});
// ─── 404 ───
app.use((_req, res) => {
    res.status(404).json({ success: false, message: "Route not found" });
});
// ─── Global Error Handler ───
app.use(errorHandler_1.errorHandler);
// ─── Start ───
const PORT = process.env.PORT || 3000;
(0, db_1.connectDB)()
    .then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 SANGI Backend running on http://localhost:${PORT}`);
    });
})
    .catch((err) => {
    console.error("❌ Failed to connect to DB:", err);
    process.exit(1);
});
exports.default = app;
//# sourceMappingURL=app.js.map
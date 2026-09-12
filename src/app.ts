import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
dotenv.config();

import { connectDB } from "./config/db";
import { errorHandler } from "./middleware/errorHandler";
import { locationLogger, searchLogger } from "./middleware/requestLogger";

import authRoutes from "./modules/auth/auth.routes";
import userRoutes from "./modules/users/users.routes";
import staffRoutes from "./modules/staff/staff.routes";
import bookingRoutes from "./modules/bookings/bookings.routes";
import walletRoutes from "./modules/wallet/wallet.routes";
import notificationRoutes from "./modules/notifications/notifications.routes";
import webhookRoutes from "./modules/webhooks/webhooks.routes";

const app = express();

// ─── Security & Parsing ───
app.use(helmet());
app.use(cors({ origin: "*", credentials: true }));

// Webhook must use raw body BEFORE express.json()
app.use("/api/v1/webhook", webhookRoutes);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Location & search logging (helps watch live updates in pm2 / journalctl) ───
app.use("/api/v1", locationLogger);
app.use("/api/v1", searchLogger);

// ─── Routes ───
app.use("/api/v1/auth", authRoutes);
app.use("/api/v1/users", userRoutes);
app.use("/api/v1/staff", staffRoutes);
app.use("/api/v1/bookings", bookingRoutes);
app.use("/api/v1/wallet", walletRoutes);
app.use("/api/v1/notifications", notificationRoutes);

// ─── Health Check ───
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ─── 404 ───
app.use((_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ─── Global Error Handler ───
app.use(errorHandler);

// ─── Start ───
const PORT = process.env.PORT || 3000;

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 SANGI Backend running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to connect to DB:", err);
    process.exit(1);
  });

export default app;

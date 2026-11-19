import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { apiLimiter } from "./middleware/rateLimiters.js";
import { allowConfiguredOrigin, hideServerFiles, sameOriginJson } from "./middleware/security.js";
import addressRoutes from "./routes/addressRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import bookingRoutes from "./routes/bookingRoutes.js";
import orderRoutes from "./routes/orderRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import productRoutes from "./routes/productRoutes.js";
import pricingRoutes from "./routes/pricingRoutes.js";
import {
  adminPlatformFeeSettlementRoutes,
  shopPlatformFeeSettlementRoutes
} from "./routes/platformFeeSettlementRoutes.js";
import shopRoutes from "./routes/shopRoutes.js";
import uploadRoutes from "./routes/uploadRoutes.js";

const app = express();
const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

app.disable("x-powered-by");
app.set("trust proxy", env.isProduction ? 1 : false);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "https://api.cloudinary.com"],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    }
  },
  hsts: env.isProduction ? undefined : false,
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "256kb", strict: true }));
app.use(cookieParser());
app.use("/api", allowConfiguredOrigin, apiLimiter, sameOriginJson);

app.get("/api/health", (_req, res) => {
  const ready = Boolean(app.locals.databaseReady);
  res.status(ready ? 200 : 503).json({
    data: { status: ready ? "ready" : "not-ready" }
  });
});
app.use("/api/admin/platform-fee-settlements", adminPlatformFeeSettlementRoutes);
app.use("/api/shops/me/platform-fee-settlements", shopPlatformFeeSettlementRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/shops", shopRoutes);
app.use("/api/products", productRoutes);
app.use("/api/pricing", pricingRoutes);
app.use("/api/uploads", uploadRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/address", addressRoutes);
app.use("/api", notFound);

app.use(hideServerFiles);
app.use(express.static(projectRoot, {
  dotfiles: "deny",
  index: "index.html",
  fallthrough: true,
  setHeaders(res) {
    res.setHeader("X-Content-Type-Options", "nosniff");
  }
}));
app.use(notFound);
app.use(errorHandler);

export default app;

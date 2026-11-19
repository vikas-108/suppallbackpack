import { Router } from "express";
import {
  createShopFeeSettlementRequest,
  getAdminFeeSettlements,
  getShopFeeSettlementSummary,
  markAdminFeeSettlementPaid
} from "../controllers/platformFeeSettlementController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

export const shopPlatformFeeSettlementRoutes = Router();
shopPlatformFeeSettlementRoutes.use(requireAuth, requireRole("shop_owner"));
shopPlatformFeeSettlementRoutes.get("/", getShopFeeSettlementSummary);
shopPlatformFeeSettlementRoutes.post("/", createShopFeeSettlementRequest);

export const adminPlatformFeeSettlementRoutes = Router();
adminPlatformFeeSettlementRoutes.use(requireAuth, requireRole("admin"));
adminPlatformFeeSettlementRoutes.get("/", getAdminFeeSettlements);
adminPlatformFeeSettlementRoutes.patch("/:settlementId/confirm", markAdminFeeSettlementPaid);

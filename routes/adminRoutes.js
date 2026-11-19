import { Router } from "express";
import {
  deleteShop,
  deleteUser,
  getOverview,
  getPlatformFee,
  getSettings,
  grantUser,
  revokeUser,
  updateSettings,
  updatePlatformFee,
  updateShopAccess,
  updateUserAccess
} from "../controllers/adminController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));
router.get("/overview", getOverview);
router.get("/settings", getSettings);
router.put("/settings", updateSettings);
router.get("/platform-fee", getPlatformFee);
router.put("/platform-fee", updatePlatformFee);
router.patch("/users/:userId/access", grantUser);
router.delete("/users/:userId/access", revokeUser);
router.patch("/users/:userId/active", updateUserAccess);
router.delete("/users/:userId", deleteUser);
router.patch("/shops/:shopId/active", updateShopAccess);
router.delete("/shops/:shopId", deleteShop);

export default router;

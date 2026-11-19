import { Router } from "express";
import {
  addDeliveryUser,
  changeDeliveryUserStatus,
  changeShopStatus,
  createShop,
  getDeliveryUsers,
  getShop,
  updateShop
} from "../controllers/shopController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { registrationLimiter } from "../middleware/rateLimiters.js";

const router = Router();
const ownerOnly = [requireAuth, requireRole("shop_owner")];

router.post("/register", ...ownerOnly, registrationLimiter, createShop);
router.get("/me", ...ownerOnly, getShop);
router.patch("/me", ...ownerOnly, updateShop);
router.patch("/me/status", ...ownerOnly, changeShopStatus);
router.get("/me/delivery-users", ...ownerOnly, getDeliveryUsers);
router.post("/me/delivery-users", ...ownerOnly, registrationLimiter, addDeliveryUser);
router.patch("/me/delivery-users/:userId/active", ...ownerOnly, changeDeliveryUserStatus);

export default router;

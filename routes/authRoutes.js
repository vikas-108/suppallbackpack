import { Router } from "express";
import {
  currentUser,
  acceptTerms,
  getMyInactivityPreference,
  login,
  logout,
  realtimeToken,
  register,
  updateMyInactivityPreference
} from "../controllers/authController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { loginLimiter, registrationLimiter } from "../middleware/rateLimiters.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();

router.post("/login", loginLimiter, login);
router.post("/register", registrationLimiter, register);
router.get("/me", requireAuth, currentUser);
router.post("/accept-terms", requireAuth, acceptTerms);
router.get("/me/inactivity-policy", requireAuth, requireRole("buyer", "shop_owner", "delivery"), getMyInactivityPreference);
router.put("/me/inactivity-policy", requireAuth, requireRole("buyer", "shop_owner", "delivery"), updateMyInactivityPreference);
router.get("/realtime-token", requireAuth, requireRole("buyer", "shop_owner", "delivery"), realtimeToken);
router.post("/logout", asyncHandler(logout));

export default router;

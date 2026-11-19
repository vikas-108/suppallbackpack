import { Router } from "express";
import {
  getNotifications,
  readAllNotifications,
  readNotification
} from "../controllers/notificationController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const signedInUser = [requireAuth, requireRole("shop_owner", "delivery")];

router.get("/", ...signedInUser, getNotifications);
router.patch("/read-all", ...signedInUser, readAllNotifications);
router.patch("/:notificationId/read", ...signedInUser, readNotification);

export default router;

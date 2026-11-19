import { Router } from "express";
import { getBookings, submitBooking, updateBooking } from "../controllers/bookingController.js";
import { optionalAuth, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.post("/", optionalAuth, submitBooking);
router.get("/", requireAuth, requireRole("shop_owner", "delivery"), getBookings);
router.patch("/:bookingNumber/status", requireAuth, requireRole("shop_owner"), updateBooking);

export default router;

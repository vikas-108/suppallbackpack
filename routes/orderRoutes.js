import { Router } from "express";
import { cancelMyOrder, getMyOrders, getOrders, updateOrder } from "../controllers/orderController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.get("/mine", requireAuth, getMyOrders);
router.patch("/mine/:orderNumber/cancel", requireAuth, requireRole("buyer"), cancelMyOrder);
router.get("/", requireAuth, requireRole("shop_owner", "delivery"), getOrders);
router.patch("/:orderNumber/status", requireAuth, requireRole("shop_owner", "delivery"), updateOrder);

export default router;

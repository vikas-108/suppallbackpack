import { Router } from "express";
import { signProductUpload } from "../controllers/uploadController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { uploadLimiter } from "../middleware/rateLimiters.js";

const router = Router();

router.post("/sign", uploadLimiter, requireAuth, requireRole("shop_owner"), signProductUpload);

export default router;

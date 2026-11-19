import { Router } from "express";
import { getMyAddress, saveMyAddress } from "../controllers/addressController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const signedInUser = [requireAuth, requireRole("shop_owner", "delivery")];

router.get("/me", ...signedInUser, getMyAddress);
router.put("/me", ...signedInUser, saveMyAddress);

export default router;

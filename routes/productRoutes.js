import { Router } from "express";
import {
  addProduct,
  addProductViews,
  editProduct,
  getMyProducts,
  getPublicProducts,
  rateProduct,
  removeProduct,
  setPublication
} from "../controllers/productController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const ownerOnly = [requireAuth, requireRole("shop_owner")];

router.get("/", getPublicProducts);
router.post("/views", addProductViews);
router.post("/:productId/ratings", rateProduct);
router.get("/mine", ...ownerOnly, getMyProducts);
router.post("/", ...ownerOnly, addProduct);
router.patch("/:productId/publication", ...ownerOnly, setPublication);
router.patch("/:productId", ...ownerOnly, editProduct);
router.delete("/:productId", ...ownerOnly, removeProduct);

export default router;

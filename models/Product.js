import mongoose from "mongoose";
import { constructionCategories } from "../utils/validation.js";

const productSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  category: { type: String, enum: constructionCategories, required: true },
  unit: { type: String, required: true, trim: true, maxlength: 40 },
  price: { type: Number, required: true, min: 0.01, max: 100000000 },
  stock: { type: Number, required: true, min: 0, max: 100000000 },
  gstRate: { type: Number, enum: [0, 5, 12, 18, 28], required: true },
  gstEnabled: { type: Boolean, required: true },
  description: { type: String, default: "", trim: true, maxlength: 240 },
  imageUrl: { type: String, default: "", maxlength: 2048 },
  imagePublicId: { type: String, default: "", maxlength: 240 },
  emoji: { type: String, default: "🧰", maxlength: 8 },
  color: { type: String, default: "#e9eee5", maxlength: 20 },
  rating: { type: String, default: "New", maxlength: 12 },
  ratingTotal: { type: Number, default: 0, min: 0 },
  ratingCount: { type: Number, default: 0, min: 0 },
  totalOrders: { type: Number, default: 0, min: 0 },
  views: { type: Number, default: 0, min: 0 },
  published: { type: Boolean, default: true, index: true },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, versionKey: false });

productSchema.index({ shopId: 1, isActive: 1, published: 1 });

export default mongoose.models.Product || mongoose.model("Product", productSchema);

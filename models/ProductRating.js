import mongoose from "mongoose";

const productRatingSchema = new mongoose.Schema({
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
  score: { type: Number, required: true, min: 1, max: 5 }
}, { timestamps: true, versionKey: false });

productRatingSchema.index({ bookingId: 1 }, { unique: true });
productRatingSchema.index({ shopId: 1 });
productRatingSchema.index({ productId: 1, createdAt: -1 });

export default mongoose.models.ProductRating || mongoose.model("ProductRating", productRatingSchema);

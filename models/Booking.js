import mongoose from "mongoose";

const bookingSchema = new mongoose.Schema({
  bookingNumber: { type: String, required: true, unique: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  productName: { type: String, required: true, trim: true },
  productUnit: { type: String, required: true, trim: true },
  supplier: { type: String, required: true, trim: true },
  buyerName: { type: String, required: true, trim: true, maxlength: 120 },
  buyerPhone: { type: String, required: true, trim: true, maxlength: 30 },
  paymentMethod: { type: String, enum: ["COD", "POD"], default: "COD", required: true },
  projectSite: { type: String, required: true, trim: true, maxlength: 160 },
  deliveryDate: { type: Date, required: true },
  deliveryAddress: { type: String, required: true, trim: true, maxlength: 240 },
  deliveryCity: { type: String, required: true, trim: true, maxlength: 100 },
  deliveryState: { type: String, required: true, trim: true, maxlength: 80 },
  deliveryPin: { type: String, required: true, match: /^\d{6}$/ },
  deliveryNotes: { type: String, default: "", trim: true, maxlength: 240 },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true, min: 0 },
  gst: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, required: true, min: 0, max: 28 },
  gstEnabled: { type: Boolean, required: true },
  platformFee: { type: Number, required: true, min: 0 },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ["Pending", "Confirmed", "Declined", "Cancelled", "Completed"], default: "Pending", index: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", default: null }
}, { timestamps: true, versionKey: false });

bookingSchema.index({ shopId: 1, createdAt: -1 });
bookingSchema.index({ buyerId: 1, createdAt: -1 });

export default mongoose.models.Booking || mongoose.model("Booking", bookingSchema);

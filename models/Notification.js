import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  kind: { type: String, enum: ["booking", "order", "shop"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  message: { type: String, required: true, trim: true, maxlength: 280 },
  href: { type: String, required: true, trim: true, maxlength: 80 },
  relatedId: { type: String, default: "", maxlength: 80 },
  readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false });

notificationSchema.index({ shopId: 1, createdAt: -1 });

export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);

import mongoose from "mongoose";

const platformFeeSettlementSchema = new mongoose.Schema({
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true },
  amount: { type: Number, required: true, min: 0 },
  orderCount: { type: Number, required: true, min: 1 },
  paymentMethod: { type: String, enum: ["upi_transfer", "cash_at_office", "admin_call"], required: true },
  status: { type: String, enum: ["pending", "paid"], default: "pending", required: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  confirmedAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

platformFeeSettlementSchema.index({ shopId: 1, createdAt: -1 });
platformFeeSettlementSchema.index({ shopId: 1, status: 1 });
platformFeeSettlementSchema.index({ status: 1, createdAt: -1 });

export default mongoose.models.PlatformFeeSettlement ||
  mongoose.model("PlatformFeeSettlement", platformFeeSettlementSchema);

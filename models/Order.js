import mongoose from "mongoose";
import { ORDER_STATUSES } from "../utils/orderLifecycle.js";

const orderStatusHistorySchema = new mongoose.Schema({
  status: { type: String, enum: ORDER_STATUSES, required: true },
  updatedByRole: { type: String, enum: ["buyer", "shop_owner", "delivery", "system"], required: true },
  updatedAt: { type: Date, required: true, default: Date.now }
}, { _id: false });

const orderSchema = new mongoose.Schema({
  orderNumber: { type: String, required: true, unique: true },
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true, unique: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
  customer: { type: String, required: true, trim: true, maxlength: 120 },
  supplier: { type: String, default: "BuildSupply supplier", trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  paymentMethod: { type: String, enum: ["COD", "POD"], default: "COD", required: true },
  site: { type: String, required: true, trim: true, maxlength: 160 },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, required: true, trim: true, maxlength: 80 },
  pin: { type: String, required: true, match: /^\d{6}$/ },
  item: { type: String, required: true, trim: true, maxlength: 200 },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true, min: 0 },
  gst: { type: Number, required: true, min: 0 },
  gstRate: { type: Number, required: true, min: 0, max: 28 },
  platformFee: { type: Number, required: true, min: 0 },
  platformFeeSettlementId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "PlatformFeeSettlement",
    default: null
  },
  amount: { type: Number, required: true, min: 0 },
  status: {
    type: String,
    enum: [...ORDER_STATUSES, "Processing", "Paid"],
    default: "Accepted",
    index: true
  },
  statusHistory: { type: [orderStatusHistorySchema], default: [] },
  date: { type: Date, required: true }
}, { timestamps: true, versionKey: false });

orderSchema.index({ shopId: 1, createdAt: -1 });
orderSchema.index({ shopId: 1, status: 1, platformFeeSettlementId: 1 });
orderSchema.index({ buyerId: 1, createdAt: -1 });

export default mongoose.models.Order || mongoose.model("Order", orderSchema);

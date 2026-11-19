import mongoose from "mongoose";
import { indianStates } from "../utils/validation.js";

const addressSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  business: { type: String, required: true, trim: true, maxlength: 120 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  country: { type: String, enum: ["India"], default: "India" },
  street: { type: String, required: true, trim: true, maxlength: 240 },
  locality: { type: String, required: true, trim: true, maxlength: 120 },
  landmark: { type: String, default: "", trim: true, maxlength: 160 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  district: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, enum: indianStates, required: true },
  pin: { type: String, required: true, match: /^\d{6}$/ },
  latitude: { type: Number, min: -90, max: 90, default: null },
  longitude: { type: Number, min: -180, max: 180, default: null }
}, { timestamps: true, versionKey: false });

export default mongoose.models.Address || mongoose.model("Address", addressSchema);

import mongoose from "mongoose";
import { supportedCountryCodes } from "../utils/phone.js";

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, trim: true, lowercase: true, maxlength: 254 },
  countryCode: { type: String, enum: supportedCountryCodes, required: true },
  phone: { type: String, required: true, match: /^\d{7,15}$/ },
  passwordHash: { type: String, required: true, select: false },
  termsAcceptedAt: { type: Date, default: null },
  termsVersion: { type: String, default: "" },
  role: { type: String, enum: ["admin", "buyer", "shop_owner", "delivery"], required: true },
  shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop" },
  inactiveAccountMonths: { type: Number, enum: [2, 6, 12, 18, null], default: undefined },
  isActive: { type: Boolean, default: true, index: true },
  lastLoginAt: { type: Date, default: null }
}, { timestamps: true, versionKey: false });

userSchema.index({ countryCode: 1, phone: 1 }, { unique: true });
userSchema.index({ shopId: 1, role: 1, isActive: 1 });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export default mongoose.models.User || mongoose.model("User", userSchema);

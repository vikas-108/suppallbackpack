import mongoose from "mongoose";
import { indianStates } from "../utils/validation.js";

const shopSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  ownerName: { type: String, required: true, trim: true, maxlength: 120 },
  email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
  phone: { type: String, required: true, trim: true, maxlength: 30 },
  supplierCategory: { type: String, required: true, trim: true, maxlength: 80 },
  gstEnabled: { type: Boolean, default: false },
  gstin: {
    type: String,
    default: "",
    uppercase: true,
    trim: true,
    validate: {
      validator(value) {
        return !this.gstEnabled || /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(value);
      },
      message: "A valid GSTIN is required when GST is enabled."
    }
  },
  address: { type: String, required: true, trim: true, maxlength: 240 },
  city: { type: String, required: true, trim: true, maxlength: 100 },
  state: { type: String, enum: indianStates, required: true },
  pin: { type: String, required: true, match: /^\d{6}$/ },
  isActive: { type: Boolean, default: true, index: true }
}, { timestamps: true, versionKey: false });

export default mongoose.models.Shop || mongoose.model("Shop", shopSchema);

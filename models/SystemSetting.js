import mongoose from "mongoose";

const systemSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true },
  inactiveAccountMonths: { type: Number, enum: [2, 6, 12, 18, null], default: null },
  platformFee: { type: Number, min: 0, max: 1000000, default: undefined }
}, { timestamps: true, versionKey: false });

export default mongoose.models.SystemSetting || mongoose.model("SystemSetting", systemSettingSchema);

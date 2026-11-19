import SystemSetting from "../models/SystemSetting.js";
import { DEFAULT_PLATFORM_FEE } from "../utils/pricing.js";

const platformFeeSettingKey = "platform-fee";

export async function getPlatformFee() {
  const setting = await SystemSetting.findOne({ key: platformFeeSettingKey }).select("platformFee");
  return setting?.platformFee ?? DEFAULT_PLATFORM_FEE;
}

export async function getPlatformFeeSettings() {
  return { platformFee: await getPlatformFee() };
}

export async function savePlatformFee(platformFee) {
  const setting = await SystemSetting.findOneAndUpdate(
    { key: platformFeeSettingKey },
    { $set: { platformFee } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return { platformFee: setting.platformFee };
}

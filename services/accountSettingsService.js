import SystemSetting from "../models/SystemSetting.js";
import User from "../models/User.js";
import { ApiError } from "../utils/apiError.js";

const inactivitySettingKey = "inactive-account-deletion";

function serializePreference(user, adminInactiveAccountMonths) {
  const useAdminPolicy = user.inactiveAccountMonths === undefined;
  return {
    useAdminPolicy,
    inactiveAccountMonths: useAdminPolicy ? null : user.inactiveAccountMonths,
    adminInactiveAccountMonths: adminInactiveAccountMonths ?? null
  };
}

export async function getInactivityPreference(user) {
  const setting = await SystemSetting.findOne({ key: inactivitySettingKey });
  return serializePreference(user, setting?.inactiveAccountMonths);
}

export async function saveInactivityPreference(userId, { useAdminPolicy, inactiveAccountMonths }) {
  const user = await User.findOne({
    _id: userId,
    role: { $in: ["buyer", "shop_owner", "delivery"] }
  });
  if (!user) throw new ApiError(404, "Account not found.", "USER_NOT_FOUND");

  if (useAdminPolicy) user.set("inactiveAccountMonths", undefined);
  else user.inactiveAccountMonths = inactiveAccountMonths;
  await user.save();
  return getInactivityPreference(user);
}

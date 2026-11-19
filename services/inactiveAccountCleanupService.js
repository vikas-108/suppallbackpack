import SystemSetting from "../models/SystemSetting.js";
import User from "../models/User.js";
import { deleteUserAccount } from "./accountDeletionService.js";

const settingKey = "inactive-account-deletion";
const intervalMs = 24 * 60 * 60 * 1000;

export function subtractMonths(date, months) {
  const result = new Date(date);
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

export async function removeInactiveAccounts(now = new Date()) {
  const setting = await SystemSetting.findOne({ key: settingKey });
  const adminMonths = setting?.inactiveAccountMonths;
  const candidatePolicies = [2, 6, 12, 18].map(months => ({
    inactiveAccountMonths: months,
    $or: [
      { lastLoginAt: { $lt: subtractMonths(now, months) } },
      { lastLoginAt: null, createdAt: { $lt: subtractMonths(now, months) } }
    ]
  }));
  if ([2, 6, 12, 18].includes(adminMonths)) {
    const cutoff = subtractMonths(now, adminMonths);
    candidatePolicies.push({
      inactiveAccountMonths: { $exists: false },
      $or: [
        { lastLoginAt: { $lt: cutoff } },
        { lastLoginAt: null, createdAt: { $lt: cutoff } }
      ]
    });
  }
  const candidates = await User.find({
    role: { $in: ["buyer", "shop_owner", "delivery"] },
    $or: candidatePolicies
  }).select("_id inactiveAccountMonths");

  let deletedUsers = 0;
  let deletedShops = 0;
  for (const candidate of candidates) {
    try {
      const months = candidate.inactiveAccountMonths ?? adminMonths;
      if (![2, 6, 12, 18].includes(months)) continue;
      const result = await deleteUserAccount(candidate._id, {
        inactiveBefore: subtractMonths(now, months),
        expectedInactiveAccountMonths: candidate.inactiveAccountMonths
      });
      if (!result) continue;
      deletedUsers += result.deletedUsers;
      if (result.deletedShop) deletedShops += 1;
    } catch (error) {
      console.error("Inactive account cleanup failed for a user.", {
        userId: String(candidate._id),
        code: error.code || "INACTIVE_ACCOUNT_CLEANUP_FAILED"
      });
    }
  }
  return { deletedUsers, deletedShops };
}

export function startInactiveAccountCleanup() {
  let running;
  const run = () => {
    if (running) return running;
    running = (async () => {
      try {
        const result = await removeInactiveAccounts();
        if (result.deletedUsers || result.deletedShops) {
          console.info("Inactive account cleanup completed.", result);
        }
      } catch (error) {
        console.error("Inactive account cleanup could not run.", {
          code: error.code || "INACTIVE_ACCOUNT_CLEANUP_FAILED"
        });
      } finally {
        running = null;
      }
    })();
    return running;
  };
  void run();
  const timer = setInterval(() => { void run(); }, intervalMs);
  timer.unref();
  return async () => {
    clearInterval(timer);
    if (running) await running;
  };
}

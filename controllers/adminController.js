import {
  grantUserAccess,
  getAdminOverview,
  getInactivitySettings,
  revokeUserAccess,
  removeAdminShop,
  removeAdminUser,
  saveInactivitySettings,
  setAdminShopActive,
  setAdminUserActive
} from "../services/adminService.js";
import { getPlatformFeeSettings, savePlatformFee } from "../services/platformFeeService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import {
  activeStatusSchema,
  adminAccessGrantSchema,
  inactivityPolicySchema,
  platformFeeSchema
} from "../utils/validation.js";

export const getOverview = asyncHandler(async (_req, res) => {
  sendData(res, await getAdminOverview());
});

export const getSettings = asyncHandler(async (_req, res) => {
  sendData(res, await getInactivitySettings());
});

export const updateSettings = asyncHandler(async (req, res) => {
  const { inactiveAccountMonths } = inactivityPolicySchema.parse(req.body);
  sendData(res, await saveInactivitySettings(inactiveAccountMonths));
});

export const getPlatformFee = asyncHandler(async (_req, res) => {
  sendData(res, await getPlatformFeeSettings());
});

export const updatePlatformFee = asyncHandler(async (req, res) => {
  const { platformFee } = platformFeeSchema.parse(req.body);
  sendData(res, await savePlatformFee(platformFee));
});

export const grantUser = asyncHandler(async (req, res) => {
  const { role, shopId } = adminAccessGrantSchema.parse(req.body);
  sendData(res, { user: await grantUserAccess(req.params.userId, role, shopId) });
});

export const revokeUser = asyncHandler(async (req, res) => {
  sendData(res, await revokeUserAccess(req.params.userId));
});

export const updateUserAccess = asyncHandler(async (req, res) => {
  const { isActive } = activeStatusSchema.parse(req.body);
  sendData(res, { user: await setAdminUserActive(req.params.userId, isActive) });
});

export const deleteUser = asyncHandler(async (req, res) => {
  sendData(res, await removeAdminUser(req.params.userId));
});

export const updateShopAccess = asyncHandler(async (req, res) => {
  const { isActive } = activeStatusSchema.parse(req.body);
  sendData(res, { shop: await setAdminShopActive(req.params.shopId, isActive) });
});

export const deleteShop = asyncHandler(async (req, res) => {
  sendData(res, await removeAdminShop(req.params.shopId));
});

import {
  confirmPlatformFeeSettlement,
  getShopPlatformFeeSummary,
  listAdminPlatformFeeSettlements,
  requestShopPlatformFeeSettlement
} from "../services/platformFeeSettlementService.js";
import { getShopId } from "../services/shopService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import { platformFeeSettlementRequestSchema } from "../utils/validation.js";

export const getShopFeeSettlementSummary = asyncHandler(async (req, res) => {
  sendData(res, await getShopPlatformFeeSummary(getShopId(req.user)));
});

export const createShopFeeSettlementRequest = asyncHandler(async (req, res) => {
  const { paymentMethod } = platformFeeSettlementRequestSchema.parse(req.body);
  const result = await requestShopPlatformFeeSettlement(
    getShopId(req.user),
    req.user._id,
    paymentMethod
  );
  sendData(res, result, 201);
});

export const getAdminFeeSettlements = asyncHandler(async (_req, res) => {
  sendData(res, { settlements: await listAdminPlatformFeeSettlements() });
});

export const markAdminFeeSettlementPaid = asyncHandler(async (req, res) => {
  sendData(res, {
    settlement: await confirmPlatformFeeSettlement(req.params.settlementId, req.user._id)
  });
});

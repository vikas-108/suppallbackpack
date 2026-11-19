import mongoose from "mongoose";
import Order from "../models/Order.js";
import PlatformFeeSettlement from "../models/PlatformFeeSettlement.js";
import { ApiError } from "../utils/apiError.js";
import { serializePlatformFeeSettlement } from "../utils/serializers.js";
import {
  PLATFORM_FEE_ELIGIBLE_ORDER_STATUSES,
  summarizePlatformFeeSettlement
} from "../utils/platformFeeSettlement.js";
import { emitToShop } from "./realtimeService.js";

const recentSettlementLimit = 20;

export async function getShopPlatformFeeSummary(shopId) {
  const [requestable, pending, settlements] = await Promise.all([
    Order.aggregate([
      {
        $match: {
          shopId,
          status: { $in: PLATFORM_FEE_ELIGIBLE_ORDER_STATUSES },
          platformFeeSettlementId: null,
          platformFee: { $gt: 0 }
        }
      },
      { $group: { _id: null, amount: { $sum: "$platformFee" }, orderCount: { $sum: 1 } } }
    ]),
    PlatformFeeSettlement.aggregate([
      { $match: { shopId, status: "pending" } },
      {
        $group: {
          _id: null,
          amount: { $sum: "$amount" },
          orderCount: { $sum: "$orderCount" },
          settlementCount: { $sum: 1 }
        }
      }
    ]),
    PlatformFeeSettlement.find({ shopId }).sort({ createdAt: -1 }).limit(recentSettlementLimit)
  ]);
  const requestableTotals = requestable[0] || {};
  const pendingTotals = pending[0] || {};
  return {
    summary: summarizePlatformFeeSettlement(requestableTotals, pendingTotals),
    settlements: settlements.map(serializePlatformFeeSettlement)
  };
}

export async function requestShopPlatformFeeSettlement(shopId, userId, paymentMethod) {
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const eligibleOrderFilter = {
        shopId,
        status: { $in: PLATFORM_FEE_ELIGIBLE_ORDER_STATUSES },
        platformFeeSettlementId: null,
        platformFee: { $gt: 0 }
      };
      const [eligibleOrders] = await Order.aggregate([
        { $match: eligibleOrderFilter },
        { $group: { _id: null, amount: { $sum: "$platformFee" }, orderCount: { $sum: 1 } } }
      ]).session(session);
      if (!eligibleOrders?.orderCount) {
        throw new ApiError(409, "There are no unrequested platform fees to settle.", "NO_PLATFORM_FEES_DUE");
      }
      const amountCents = Math.round((Number(eligibleOrders.amount) + Number.EPSILON) * 100);
      if (amountCents <= 0) {
        throw new ApiError(409, "There is no platform fee amount due for these orders.", "NO_PLATFORM_FEES_DUE");
      }
      const [settlement] = await PlatformFeeSettlement.create([{
        shopId,
        amount: amountCents / 100,
        orderCount: eligibleOrders.orderCount,
        paymentMethod,
        requestedBy: userId
      }], { session });
      const linkedOrders = await Order.updateMany(
        eligibleOrderFilter,
        { $set: { platformFeeSettlementId: settlement._id } },
        { session }
      );
      if (linkedOrders.modifiedCount !== eligibleOrders.orderCount) {
        throw new ApiError(409, "The eligible orders changed. Reload the fee summary and try again.", "PLATFORM_FEE_ORDERS_CHANGED");
      }
      created = settlement;
    });
  } finally {
    await session.endSession();
  }
  emitToShop(shopId, "platform-fee.settlement.updated", {
    settlementId: String(created._id),
    status: created.status
  });
  return getShopPlatformFeeSummary(shopId);
}

export async function listAdminPlatformFeeSettlements() {
  const populateShopOwner = query => query.populate({
    path: "shopId",
    select: "name ownerName phone ownerId",
    populate: { path: "ownerId", select: "name countryCode phone" }
  }).sort({ createdAt: -1 });
  const [pending, recentlyPaid] = await Promise.all([
    populateShopOwner(PlatformFeeSettlement.find({ status: "pending" })),
    populateShopOwner(PlatformFeeSettlement.find({ status: "paid" })).limit(100)
  ]);
  return [...pending, ...recentlyPaid]
    .sort((left, right) => right.createdAt - left.createdAt)
    .map(serializePlatformFeeSettlement);
}

export async function confirmPlatformFeeSettlement(settlementId, adminId) {
  if (!mongoose.isValidObjectId(settlementId)) {
    throw new ApiError(400, "Invalid platform fee settlement.", "INVALID_ID");
  }
  const settlement = await PlatformFeeSettlement.findOneAndUpdate(
    { _id: settlementId, status: "pending" },
    { $set: { status: "paid", confirmedBy: adminId, confirmedAt: new Date() } },
    { new: true, runValidators: true }
  ).populate({
    path: "shopId",
    select: "name ownerName phone ownerId",
    populate: { path: "ownerId", select: "name countryCode phone" }
  });
  if (!settlement) {
    const existing = await PlatformFeeSettlement.findById(settlementId).select("status");
    if (!existing) throw new ApiError(404, "Platform fee settlement not found.", "SETTLEMENT_NOT_FOUND");
    throw new ApiError(409, "This platform fee settlement is no longer pending.", "SETTLEMENT_NOT_PENDING");
  }
  emitToShop(settlement.shopId._id, "platform-fee.settlement.updated", {
    settlementId: String(settlement._id),
    status: settlement.status
  });
  return serializePlatformFeeSettlement(settlement);
}

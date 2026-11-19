import mongoose from "mongoose";
import Address from "../models/Address.js";
import Booking from "../models/Booking.js";
import Notification from "../models/Notification.js";
import Order from "../models/Order.js";
import PlatformFeeSettlement from "../models/PlatformFeeSettlement.js";
import Product from "../models/Product.js";
import ProductRating from "../models/ProductRating.js";
import Shop from "../models/Shop.js";
import User from "../models/User.js";
import { deleteProductImage } from "./cloudinaryService.js";
import { disconnectUser, emitToAll } from "./realtimeService.js";
import { ApiError } from "../utils/apiError.js";

function inactiveCriteria(cutoff) {
  if (!cutoff) return {};
  return {
    $or: [
      { lastLoginAt: { $lt: cutoff } },
      { lastLoginAt: null, createdAt: { $lt: cutoff } }
    ]
  };
}

function preferenceCriteria(months) {
  return months === undefined
    ? { inactiveAccountMonths: { $exists: false } }
    : { inactiveAccountMonths: months };
}

async function deleteStandaloneUser(userId, cutoff, expectedInactiveAccountMonths) {
  const session = await mongoose.startSession();
  let deletedUser;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({
        _id: userId,
        role: { $in: ["buyer", "shop_owner", "delivery"] },
        ...inactiveCriteria(cutoff),
        ...(cutoff ? preferenceCriteria(expectedInactiveAccountMonths) : {})
      }).session(session);
      if (!user) return;
      await Address.deleteMany({ userId: user._id }).session(session);
      await Booking.deleteMany({ buyerId: user._id }).session(session);
      await Order.deleteMany({ buyerId: user._id }).session(session);
      await User.deleteOne({ _id: user._id }).session(session);
      deletedUser = user;
    });
  } finally {
    await session.endSession();
  }
  if (deletedUser) disconnectUser(deletedUser._id);
  return deletedUser ? {
    deletedUsers: 1,
    deletedShop: false,
    cloudinaryCleanupFailures: 0
  } : null;
}

async function deleteShopData(shopId, expectedOwnerId, cutoff, expectedInactiveAccountMonths) {
  const session = await mongoose.startSession();
  let deletedUserIds = [];
  let imagePublicIds = [];
  let deleted = false;
  try {
    await session.withTransaction(async () => {
      const shop = await Shop.findById(shopId).session(session);
      if (!shop) return;

      const ownerQuery = {
        _id: expectedOwnerId || shop.ownerId,
        role: { $in: ["buyer", "shop_owner"] },
        ...inactiveCriteria(cutoff),
        ...(cutoff ? preferenceCriteria(expectedInactiveAccountMonths) : {})
      };
      const owner = await User.findOne(ownerQuery).session(session);
      if (cutoff && !owner) return;
      if (expectedOwnerId && !owner) return;

      const deliveryUsers = await User.find({ shopId, role: "delivery" }).select("_id").session(session);
      const userIds = [...(owner ? [owner._id] : []), ...deliveryUsers.map(user => user._id)];
      const products = await Product.find({ shopId }).select("imagePublicId").session(session);
      imagePublicIds = products.map(product => product.imagePublicId).filter(Boolean);

      await Address.deleteMany({ userId: { $in: userIds } }).session(session);
      await ProductRating.deleteMany({ shopId }).session(session);
      await PlatformFeeSettlement.deleteMany({ shopId }).session(session);
      await Order.deleteMany({ $or: [{ shopId }, { buyerId: { $in: userIds } }] }).session(session);
      await Booking.deleteMany({ $or: [{ shopId }, { buyerId: { $in: userIds } }] }).session(session);
      await Notification.deleteMany({ shopId }).session(session);
      await Product.deleteMany({ shopId }).session(session);
      await Shop.deleteOne({ _id: shopId }).session(session);
      if (userIds.length) await User.deleteMany({ _id: { $in: userIds } }).session(session);

      deletedUserIds = userIds;
      deleted = true;
    });
  } finally {
    await session.endSession();
  }

  if (!deleted) return null;
  deletedUserIds.forEach(disconnectUser);
  emitToAll("catalog.updated", { shopId: String(shopId) });

  let cloudinaryCleanupFailures = 0;
  for (const publicId of imagePublicIds) {
    try {
      await deleteProductImage(shopId, publicId);
    } catch (error) {
      cloudinaryCleanupFailures += 1;
      console.error("Deleted shop image cleanup failed.", {
        shopId: String(shopId),
        code: error.code || "CLOUDINARY_DELETE_FAILED"
      });
    }
  }

  return {
    deletedUsers: deletedUserIds.length,
    deletedShop: true,
    cloudinaryCleanupFailures
  };
}

export async function deleteUserAccount(userId, {
  inactiveBefore = null,
  expectedInactiveAccountMonths
} = {}) {
  if (!mongoose.isValidObjectId(userId)) {
    throw new ApiError(400, "Invalid user.", "INVALID_ID");
  }
  const criteria = {
    ...inactiveCriteria(inactiveBefore),
    ...(inactiveBefore ? preferenceCriteria(expectedInactiveAccountMonths) : {})
  };
  const user = await User.findOne({
    _id: userId,
    role: { $in: ["buyer", "shop_owner", "delivery"] },
    ...criteria
  });
  if (!user) return null;

  const shop = await Shop.findOne({ ownerId: user._id }).select("_id");
  if (shop) return deleteShopData(shop._id, user._id, inactiveBefore, expectedInactiveAccountMonths);
  return deleteStandaloneUser(user._id, inactiveBefore, expectedInactiveAccountMonths);
}

export async function deleteShopAccount(shopId) {
  if (!mongoose.isValidObjectId(shopId)) {
    throw new ApiError(400, "Invalid shop.", "INVALID_ID");
  }
  const shop = await Shop.findById(shopId).select("ownerId");
  if (!shop) throw new ApiError(404, "Shop not found.", "SHOP_NOT_FOUND");
  return deleteShopData(shop._id, null, null);
}

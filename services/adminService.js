import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import SystemSetting from "../models/SystemSetting.js";
import User from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { serializeBooking, serializeOrder, serializeProduct, serializeShop } from "../utils/serializers.js";
import { deleteShopAccount, deleteUserAccount } from "./accountDeletionService.js";
import { disconnectUser, emitToAll, emitToShop } from "./realtimeService.js";

const inactivitySettingKey = "inactive-account-deletion";

function validateId(id, label) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(400, `Invalid ${label}.`, "INVALID_ID");
}

function serializeAdminUser(user) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email || "",
    countryCode: user.countryCode,
    phone: user.phone,
    role: user.role,
    shopId: user.shopId ? String(user.shopId) : "",
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt?.toISOString?.() || null,
    createdAt: user.createdAt?.toISOString?.() || ""
  };
}

function serializeAdminShop(shop) {
  const owner = shop.ownerId && typeof shop.ownerId === "object" ? shop.ownerId : null;
  return {
    ...serializeShop(shop),
    owner: owner ? {
      id: String(owner._id),
      name: owner.name,
      email: owner.email || "",
      countryCode: owner.countryCode,
      phone: owner.phone,
      isActive: owner.isActive
    } : null,
    createdAt: shop.createdAt?.toISOString?.() || ""
  };
}

export async function getAdminOverview() {
  const [users, shops, products, bookings, orders] = await Promise.all([
    User.find().sort({ createdAt: -1 }),
    Shop.find().populate({
      path: "ownerId",
      select: "name email countryCode phone isActive"
    }).sort({ createdAt: -1 }),
    Product.find().populate("shopId", "name").sort({ createdAt: -1 }),
    Booking.find().sort({ createdAt: -1 }),
    Order.find().sort({ createdAt: -1 })
  ]);
  return {
    users: users.map(serializeAdminUser),
    shops: shops.map(serializeAdminShop),
    products: products.map(serializeProduct),
    bookings: bookings.map(serializeBooking),
    orders: orders.map(serializeOrder)
  };
}

export async function getInactivitySettings() {
  const setting = await SystemSetting.findOne({ key: inactivitySettingKey });
  return { inactiveAccountMonths: setting?.inactiveAccountMonths ?? null };
}

export async function saveInactivitySettings(inactiveAccountMonths) {
  const setting = await SystemSetting.findOneAndUpdate(
    { key: inactivitySettingKey },
    { $set: { inactiveAccountMonths } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return { inactiveAccountMonths: setting.inactiveAccountMonths };
}

export async function grantUserAccess(userId, role, shopId = null) {
  validateId(userId, "user");
  const user = await User.findById(userId);
  if (!user || user.role === "admin") {
    throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
  }
  if (user.role !== "buyer") {
    throw new ApiError(409, "Access can only be granted to a buyer account.", "ACCESS_ALREADY_ASSIGNED");
  }

  if (role === "delivery") {
    validateId(shopId, "shop");
    const shop = await Shop.findById(shopId);
    if (!shop) throw new ApiError(404, "Shop not found.", "SHOP_NOT_FOUND");
    if (!shop.isActive) throw new ApiError(409, "Activate the shop before granting delivery access.", "SHOP_INACTIVE");
    user.shopId = shop._id;
  } else {
    const shop = await Shop.findOne({ ownerId: user._id }).select("_id");
    user.shopId = shop?._id;
  }

  user.role = role;
  user.isActive = true;
  await user.save();
  return serializeAdminUser(user);
}

export async function revokeUserAccess(userId) {
  validateId(userId, "user");
  const session = await mongoose.startSession();
  let revokedUser;
  let pausedShop;
  try {
    await session.withTransaction(async () => {
      revokedUser = null;
      pausedShop = null;
      const user = await User.findById(userId).session(session);
      if (!user || user.role === "admin") {
        throw new ApiError(404, "User not found.", "USER_NOT_FOUND");
      }
      if (!["shop_owner", "delivery"].includes(user.role)) {
        throw new ApiError(409, "This account has no shop-owner or delivery access to remove.", "ACCESS_NOT_ASSIGNED");
      }

      if (user.role === "shop_owner") {
        const shop = await Shop.findOne({ ownerId: user._id }).session(session);
        if (shop?.isActive) {
          shop.isActive = false;
          await shop.save({ session });
          pausedShop = shop;
        }
      }

      user.role = "buyer";
      user.shopId = undefined;
      await user.save({ session });
      revokedUser = user;
    });
  } finally {
    await session.endSession();
  }

  disconnectUser(revokedUser._id);
  if (pausedShop) {
    emitToAll("catalog.updated", { shopId: String(pausedShop._id) });
    emitToShop(pausedShop._id, "shop.updated", { isActive: false });
  }
  return {
    user: serializeAdminUser(revokedUser),
    shopPaused: Boolean(pausedShop)
  };
}

export async function setAdminUserActive(userId, isActive) {
  validateId(userId, "user");
  const user = await User.findById(userId);
  if (!user || user.role === "admin") {
    throw new ApiError(404, "Managed user not found.", "USER_NOT_FOUND");
  }
  user.isActive = isActive;
  await user.save();
  if (!isActive) disconnectUser(user._id);
  return serializeAdminUser(user);
}

export async function removeAdminUser(userId) {
  validateId(userId, "user");
  const user = await User.findById(userId);
  if (!user || user.role === "admin") {
    throw new ApiError(404, "Managed user not found.", "USER_NOT_FOUND");
  }
  const result = await deleteUserAccount(user._id);
  if (!result) throw new ApiError(409, "The user changed while deletion was in progress.", "USER_DELETE_CONFLICT");
  return result;
}

export async function setAdminShopActive(shopId, isActive) {
  validateId(shopId, "shop");
  const shop = await Shop.findByIdAndUpdate(
    shopId,
    { $set: { isActive } },
    { new: true, runValidators: true }
  );
  if (!shop) throw new ApiError(404, "Shop not found.", "SHOP_NOT_FOUND");
  emitToAll("catalog.updated", { shopId: String(shop._id) });
  emitToShop(shop._id, "shop.updated", { isActive: shop.isActive });
  return serializeShop(shop);
}

export async function removeAdminShop(shopId) {
  const result = await deleteShopAccount(shopId);
  if (!result) throw new ApiError(409, "The shop changed while deletion was in progress.", "SHOP_DELETE_CONFLICT");
  return result;
}

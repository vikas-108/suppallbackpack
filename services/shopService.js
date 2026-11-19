import mongoose from "mongoose";
import { env } from "../config/env.js";
import Address from "../models/Address.js";
import Product from "../models/Product.js";
import Shop from "../models/Shop.js";
import User from "../models/User.js";
import { hashPassword } from "./authService.js";
import { ApiError } from "../utils/apiError.js";
import { normalizePhone, parseInternationalPhone } from "../utils/phone.js";
import { serializeDeliveryUser, serializeShop } from "../utils/serializers.js";
import { disconnectUser, emitToAll, emitToShop } from "./realtimeService.js";

function shopValues(data) {
  const phone = parseInternationalPhone(data.shopPhone);
  return {
    name: data.shopName,
    ownerName: data.ownerName,
    email: data.shopEmail.toLowerCase(),
    phone: `${phone.countryCode}${phone.phone}`,
    supplierCategory: data.supplierCategory,
    gstEnabled: data.gstEnabled,
    gstin: data.gstEnabled ? data.gstin.toUpperCase() : "",
    address: data.shopAddress,
    city: data.shopCity,
    state: data.shopState,
    pin: data.shopPin
  };
}

export async function registerShop(userId, data) {
  const session = await mongoose.startSession();
  let created;
  try {
    await session.withTransaction(async () => {
      const user = await User.findOne({
        _id: userId,
        role: "shop_owner",
        isActive: true
      }).session(session);
      if (!user) throw new ApiError(403, "Administrator approval is required before registering a shop.", "SHOP_ACCESS_REQUIRED");
      if (await Shop.findOne({ ownerId: user._id }).session(session)) {
        throw new ApiError(409, "This account already has a registered shop.", "SHOP_ALREADY_REGISTERED");
      }
      const [shop] = await Shop.create([{
        ownerId: user._id,
        ...shopValues(data)
      }], { session });
      user.name = data.ownerName;
      user.email = data.shopEmail.toLowerCase();
      user.shopId = shop._id;
      await user.save({ session });
      created = { user, shop };
    });
  } finally {
    await session.endSession();
  }
  return created;
}

export async function getOwnedShop(userId) {
  const shop = await Shop.findOne({ ownerId: userId });
  if (!shop) throw new ApiError(404, "Register a shop before managing products.", "SHOP_NOT_FOUND");
  return shop;
}

export async function updateOwnedShop(userId, data) {
  const shop = await Shop.findOneAndUpdate(
    { ownerId: userId },
    { $set: shopValues(data) },
    { new: true, runValidators: true }
  );
  if (!shop) throw new ApiError(404, "Shop not found.", "SHOP_NOT_FOUND");
  await Product.updateMany({ shopId: shop._id, isActive: true }, { $set: { gstEnabled: shop.gstEnabled } });
  emitToAll("catalog.updated", { shopId: String(shop._id) });
  emitToShop(shop._id, "shop.updated", { isActive: shop.isActive });
  return shop;
}

export async function setShopActive(userId, isActive) {
  const shop = await Shop.findOneAndUpdate({ ownerId: userId }, { $set: { isActive } }, { new: true });
  if (!shop) throw new ApiError(404, "Shop not found.", "SHOP_NOT_FOUND");
  emitToAll("catalog.updated", { shopId: String(shop._id) });
  emitToShop(shop._id, "shop.updated", { isActive: shop.isActive });
  return shop;
}

export async function listDeliveryUsers(shopId) {
  const users = await User.find({ shopId, role: "delivery" }).sort({ createdAt: -1 });
  return users.map(serializeDeliveryUser);
}

export async function createDeliveryUser(shopId, data) {
  const phone = normalizePhone(data.countryCode, data.phone);
  const passwordHash = await hashPassword(data.password);
  const user = await User.create({
    name: data.name,
    countryCode: data.countryCode,
    phone,
    passwordHash,
    role: "delivery",
    shopId
  });
  emitToShop(shopId, "staff.updated", { userId: String(user._id), isActive: user.isActive });
  return serializeDeliveryUser(user);
}

export async function setDeliveryUserActive(shopId, userId, isActive) {
  if (!mongoose.isValidObjectId(userId)) throw new ApiError(400, "Invalid delivery user.", "INVALID_ID");
  const user = await User.findOneAndUpdate(
    { _id: userId, shopId, role: "delivery" },
    { $set: { isActive } },
    { new: true }
  );
  if (!user) throw new ApiError(404, "Delivery user not found.", "DELIVERY_USER_NOT_FOUND");
  if (!isActive) disconnectUser(user._id);
  emitToShop(shopId, "staff.updated", { userId: String(user._id), isActive: user.isActive });
  return serializeDeliveryUser(user);
}

export async function getShopSettings(userId) {
  const shop = await Shop.findOne({ ownerId: userId });
  return shop ? serializeShop(shop) : null;
}

export function getShopId(user) {
  if (!user.shopId) throw new ApiError(404, "This account is not linked to a shop.", "SHOP_NOT_FOUND");
  return user.shopId;
}

export function requireAtlasTlsConfiguration() {
  if (env.isProduction && !env.mongoUri.startsWith("mongodb+srv://")) {
    throw new ApiError(503, "Production database connections must use MongoDB Atlas TLS.", "DATABASE_TLS_REQUIRED");
  }
}

export async function getAddressRecord(userId) {
  return Address.findOne({ userId });
}

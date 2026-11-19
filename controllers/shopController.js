import {
  createDeliveryUser,
  getOwnedShop,
  listDeliveryUsers,
  registerShop,
  setDeliveryUserActive,
  setShopActive,
  updateOwnedShop
} from "../services/shopService.js";
import { getShopId } from "../services/shopService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import { serializeShop, serializeUser, serializeDeliveryUser } from "../utils/serializers.js";
import { activeStatusSchema, deliveryUserSchema, shopRegistrationSchema, shopUpdateSchema } from "../utils/validation.js";

export const createShop = asyncHandler(async (req, res) => {
  const data = shopRegistrationSchema.parse(req.body);
  const { user, shop } = await registerShop(req.user._id, data);
  sendData(res, { user: serializeUser(user), shop: serializeShop(shop) }, 201);
});

export const getShop = asyncHandler(async (req, res) => {
  const shop = await getOwnedShop(req.user._id);
  sendData(res, { shop: serializeShop(shop) });
});

export const updateShop = asyncHandler(async (req, res) => {
  const data = shopUpdateSchema.parse(req.body);
  const shop = await updateOwnedShop(req.user._id, data);
  sendData(res, { shop: serializeShop(shop) });
});

export const changeShopStatus = asyncHandler(async (req, res) => {
  const { isActive } = activeStatusSchema.parse(req.body);
  const shop = await setShopActive(req.user._id, isActive);
  sendData(res, { shop: serializeShop(shop) });
});

export const getDeliveryUsers = asyncHandler(async (req, res) => {
  sendData(res, { users: await listDeliveryUsers(getShopId(req.user)) });
});

export const addDeliveryUser = asyncHandler(async (req, res) => {
  const data = deliveryUserSchema.parse(req.body);
  const user = await createDeliveryUser(getShopId(req.user), data);
  sendData(res, { user }, 201);
});

export const changeDeliveryUserStatus = asyncHandler(async (req, res) => {
  const { isActive } = activeStatusSchema.parse(req.body);
  const user = await setDeliveryUserActive(getShopId(req.user), req.params.userId, isActive);
  sendData(res, { user });
});

import { cancelBuyerOrder, listBuyerOrders, listShopOrders, updateOrderStatus } from "../services/orderService.js";
import { getShopId } from "../services/shopService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import { orderStatusSchema } from "../utils/validation.js";

export const getOrders = asyncHandler(async (req, res) => {
  sendData(res, { orders: await listShopOrders(getShopId(req.user)) });
});

export const getMyOrders = asyncHandler(async (req, res) => {
  sendData(res, { orders: await listBuyerOrders(req.user._id) });
});

export const cancelMyOrder = asyncHandler(async (req, res) => {
  sendData(res, { order: await cancelBuyerOrder(req.params.orderNumber, req.user) });
});

export const updateOrder = asyncHandler(async (req, res) => {
  const { status } = orderStatusSchema.parse(req.body);
  const order = await updateOrderStatus(getShopId(req.user), req.params.orderNumber, status, req.user);
  sendData(res, { order });
});

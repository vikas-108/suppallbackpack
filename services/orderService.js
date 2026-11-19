import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { ApiError } from "../utils/apiError.js";
import { serializeOrder } from "../utils/serializers.js";
import { createShopNotification } from "./notificationService.js";
import { canBuyerCancelOrder, canTransitionOrderStatus, normalizeOrderStatus } from "../utils/orderLifecycle.js";
import { emitToAll, emitToUser } from "./realtimeService.js";

export async function listShopOrders(shopId) {
  const orders = await Order.find({ shopId }).sort({ createdAt: -1 });
  return orders.map(serializeOrder);
}

export async function listBuyerOrders(buyerId) {
  const orders = await Order.find({ buyerId }).sort({ createdAt: -1 });
  return orders.map(serializeOrder);
}

export async function cancelBuyerOrder(orderNumber, user) {
  const session = await mongoose.startSession();
  let updated;
  let shopId;
  let restoreStock = false;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderNumber, buyerId: user._id }).session(session);
      if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
      if (!canBuyerCancelOrder(order.status)) {
        throw new ApiError(409, "This order can only be cancelled before it is out for delivery.", "ORDER_CANNOT_BE_CANCELLED");
      }

      const booking = await Booking.findOne({ _id: order.bookingId, buyerId: user._id }).session(session);
      if (!booking || !["Pending", "Confirmed"].includes(booking.status)) {
        throw new ApiError(409, "This order's booking can no longer be cancelled.", "INVALID_BOOKING_TRANSITION");
      }

      restoreStock = normalizeOrderStatus(order.status) !== "Pending";
      if (restoreStock) {
        await Product.updateOne(
          { _id: order.productId, shopId: order.shopId },
          { $inc: { stock: order.quantity } },
          { session }
        );
      }

      booking.status = "Cancelled";
      await booking.save({ session });
      order.status = "Cancelled";
      order.statusHistory.push({
        status: "Cancelled",
        updatedByRole: "buyer",
        updatedAt: new Date()
      });
      await order.save({ session });
      shopId = order.shopId;
      updated = serializeOrder(order);
    });
  } finally {
    await session.endSession();
  }

  await createShopNotification({
    shopId,
    kind: "order",
    title: "Order cancelled",
    message: `Order ${updated.id} for ${updated.customer} was cancelled by the buyer.`,
    href: "orders.html",
    relatedId: updated.id,
    event: "order.updated",
    eventData: { orderId: updated.id, status: updated.status }
  });
  if (restoreStock) emitToAll("catalog.updated", { shopId: String(shopId) });
  emitToUser(user._id, "order.updated", { orderId: updated.id, status: updated.status });
  return updated;
}

export async function updateOrderStatus(shopId, orderNumber, status, user) {
  const session = await mongoose.startSession();
  let updated;
  let buyerId;
  try {
    await session.withTransaction(async () => {
      const order = await Order.findOne({ orderNumber, shopId }).session(session);
      if (!order) throw new ApiError(404, "Order not found.", "ORDER_NOT_FOUND");
      if (!canTransitionOrderStatus(order.status, status, user.role)) {
        throw new ApiError(409, `This order cannot be changed from ${order.status} to ${status} by this account.`, "INVALID_ORDER_TRANSITION");
      }

      if (status === "Accepted" || status === "Declined") {
        const booking = await Booking.findOne({ _id: order.bookingId, shopId }).session(session);
        if (!booking || booking.status !== "Pending") {
          throw new ApiError(409, "This booking is no longer waiting for acceptance.", "INVALID_BOOKING_TRANSITION");
        }
        if (status === "Accepted") {
          const product = await Product.findOneAndUpdate(
            { _id: booking.productId, shopId, isActive: true, published: true, stock: { $gte: booking.quantity } },
            { $inc: { stock: -booking.quantity, totalOrders: 1 } },
            { new: true, session }
          );
          if (!product) throw new ApiError(409, "There is not enough stock to accept this order.", "INSUFFICIENT_STOCK");
          booking.status = "Confirmed";
        } else {
          booking.status = "Declined";
        }
        await booking.save({ session });
      }

      order.status = status;
      buyerId = order.buyerId;
      order.statusHistory.push({
        status,
        updatedByRole: user.role,
        updatedAt: new Date()
      });
      await order.save({ session });
      if (status === "Completed") {
        await Booking.updateOne({ _id: order.bookingId, shopId }, { $set: { status: "Completed" } }, { session });
      }
      updated = serializeOrder(order);
    });
  } finally {
    await session.endSession();
  }
  await createShopNotification({
    shopId,
    kind: "order",
    title: `Order ${updated.status.toLowerCase()}`,
    message: `Order ${updated.id} for ${updated.customer} was marked ${updated.status.toLowerCase()}.`,
    href: "orders.html",
    relatedId: updated.id,
    event: "order.updated",
    eventData: { orderId: updated.id, status: updated.status }
  });
  if (updated.status === "Accepted") emitToAll("catalog.updated", { shopId: String(shopId) });
  if (buyerId) {
    emitToUser(buyerId, "order.updated", { orderId: updated.id, status: updated.status });
  }
  return updated;
}

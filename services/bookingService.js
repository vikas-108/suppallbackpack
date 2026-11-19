import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import Booking from "../models/Booking.js";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import { productForBooking } from "./productService.js";
import { calculateBookingCharges } from "../utils/pricing.js";
import { ApiError } from "../utils/apiError.js";
import { parseInternationalPhone } from "../utils/phone.js";
import { serializeBooking } from "../utils/serializers.js";
import { getPlatformFee } from "./platformFeeService.js";
import { createShopNotification } from "./notificationService.js";
import { emitToAll, emitToShop, emitToUser } from "./realtimeService.js";

function newBookingNumber() {
  return `BK-${Date.now().toString().slice(-8)}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

function newOrderNumber() {
  return `ORD-${Date.now().toString().slice(-8)}-${randomBytes(2).toString("hex").toUpperCase()}`;
}

export async function createBooking(data, buyerId = null) {
  const product = await productForBooking(data.productId);
  if (product.stock < data.quantity) {
    throw new ApiError(409, `Only ${product.stock} units are currently available.`, "INSUFFICIENT_STOCK");
  }
  const deliveryDate = new Date(`${data.deliveryDate}T12:00:00.000Z`);
  if (!Number.isFinite(deliveryDate.getTime()) || deliveryDate < new Date(new Date().toISOString().slice(0, 10))) {
    throw new ApiError(400, "Choose a valid delivery date that is not in the past.", "INVALID_DELIVERY_DATE");
  }
  const phone = parseInternationalPhone(data.buyerPhone);
  const charges = calculateBookingCharges(product, data.quantity, await getPlatformFee());
  const session = await mongoose.startSession();
  let booking;
  let order;
  try {
    await session.withTransaction(async () => {
      const [createdBooking] = await Booking.create([{
        bookingNumber: newBookingNumber(),
        buyerId,
        shopId: product.shopId._id,
        productId: product._id,
        productName: product.name,
        productUnit: product.unit,
        supplier: product.shopId.name,
        buyerName: data.buyerName,
        buyerPhone: `${phone.countryCode} ${phone.phone}`,
        paymentMethod: data.paymentMethod,
        projectSite: data.projectSite,
        deliveryDate,
        deliveryAddress: data.deliveryAddress,
        deliveryCity: data.deliveryCity,
        deliveryState: data.deliveryState,
        deliveryPin: data.deliveryPin,
        deliveryNotes: data.deliveryNotes,
        quantity: data.quantity,
        ...charges,
        gstEnabled: product.gstEnabled
      }], { session });
      const [createdOrder] = await Order.create([{
        orderNumber: newOrderNumber(),
        bookingId: createdBooking._id,
        buyerId,
        productId: createdBooking.productId,
        shopId: createdBooking.shopId,
        customer: createdBooking.buyerName,
        supplier: createdBooking.supplier,
        phone: createdBooking.buyerPhone,
        paymentMethod: createdBooking.paymentMethod,
        site: createdBooking.projectSite,
        address: createdBooking.deliveryAddress,
        city: createdBooking.deliveryCity,
        state: createdBooking.deliveryState,
        pin: createdBooking.deliveryPin,
        item: `${createdBooking.productName} · ${createdBooking.quantity} ${createdBooking.productUnit}`,
        quantity: createdBooking.quantity,
        subtotal: createdBooking.subtotal,
        gst: createdBooking.gst,
        gstRate: createdBooking.gstRate,
        platformFee: createdBooking.platformFee,
        amount: createdBooking.amount,
        status: "Pending",
        statusHistory: [{ status: "Pending", updatedByRole: "system", updatedAt: new Date() }],
        date: new Date()
      }], { session });
      createdBooking.orderId = createdOrder._id;
      await createdBooking.save({ session });
      booking = createdBooking;
      order = createdOrder;
    });
  } finally {
    await session.endSession();
  }
  const serializedBooking = serializeBooking(booking);
  await createShopNotification({
    shopId: product.shopId._id,
    kind: "booking",
    title: "New material booking",
    message: `${data.buyerName} requested ${serializedBooking.item}.`,
    href: "bookings.html",
    relatedId: serializedBooking.id,
    event: "booking.created",
    eventData: { bookingId: serializedBooking.id, status: serializedBooking.status }
  });
  emitToShop(product.shopId._id, "order.updated", { orderId: order.orderNumber, status: order.status });
  if (buyerId) emitToUser(buyerId, "order.updated", { orderId: order.orderNumber, status: order.status });
  return serializedBooking;
}

export async function listShopBookings(shopId) {
  const bookings = await Booking.find({ shopId }).sort({ createdAt: -1 });
  return bookings.map(serializeBooking);
}

export async function updateBookingStatus(shopId, bookingNumber, status, user) {
  const session = await mongoose.startSession();
  let result;
  let createdOrder;
  let buyerId;
  try {
    await session.withTransaction(async () => {
      createdOrder = null;
      buyerId = null;
      const booking = await Booking.findOne({ bookingNumber, shopId }).session(session);
      if (!booking) throw new ApiError(404, "Booking not found.", "BOOKING_NOT_FOUND");
      if (booking.status !== "Pending") {
        throw new ApiError(409, `This booking cannot be changed from ${booking.status} to ${status}.`, "INVALID_BOOKING_TRANSITION");
      }
      let order = await Order.findOne({ bookingId: booking._id, shopId }).session(session);

      if (status === "Confirmed") {
        const product = await Product.findOneAndUpdate(
          { _id: booking.productId, shopId, isActive: true, published: true, stock: { $gte: booking.quantity } },
          { $inc: { stock: -booking.quantity, totalOrders: 1 } },
          { new: true, session }
        );
        if (!product) throw new ApiError(409, "There is not enough stock to confirm this booking.", "INSUFFICIENT_STOCK");
        if (!order) {
          const [legacyOrder] = await Order.create([{
            orderNumber: newOrderNumber(),
            bookingId: booking._id,
            buyerId: booking.buyerId,
            productId: booking.productId,
            shopId,
            customer: booking.buyerName,
            supplier: booking.supplier,
            phone: booking.buyerPhone,
            paymentMethod: booking.paymentMethod || "COD",
            site: booking.projectSite,
            address: booking.deliveryAddress,
            city: booking.deliveryCity,
            state: booking.deliveryState,
            pin: booking.deliveryPin,
            item: `${booking.productName} · ${booking.quantity} ${booking.productUnit}`,
            quantity: booking.quantity,
            subtotal: booking.subtotal,
            gst: booking.gst,
            gstRate: booking.gstRate,
            platformFee: booking.platformFee,
            amount: booking.amount,
            status: "Pending",
            statusHistory: [{ status: "Pending", updatedByRole: "system", updatedAt: new Date() }],
            date: new Date()
          }], { session });
          order = legacyOrder;
        }
        order.status = "Accepted";
        order.statusHistory.push({ status: "Accepted", updatedByRole: user.role, updatedAt: new Date() });
        await order.save({ session });
        booking.orderId = order._id;
        createdOrder = { id: order.orderNumber, status: order.status };
      } else if (order) {
        order.status = "Declined";
        order.statusHistory.push({ status: "Declined", updatedByRole: user.role, updatedAt: new Date() });
        await order.save({ session });
      }

      booking.status = status;
      await booking.save({ session });
      buyerId = booking.buyerId;
      if (!createdOrder && order) createdOrder = { id: order.orderNumber, status: order.status };
      result = serializeBooking(booking);
    });
  } finally {
    await session.endSession();
  }
  await createShopNotification({
    shopId,
    kind: "booking",
    title: `Booking ${status.toLowerCase()}`,
    message: `${result.customer}'s booking ${result.id} was marked ${status.toLowerCase()}.`,
    href: status === "Confirmed" ? "orders.html" : "bookings.html",
    relatedId: result.id,
    event: "booking.updated",
    eventData: { bookingId: result.id, status: result.status }
  });
  if (createdOrder) {
    emitToShop(shopId, "order.updated", { orderId: createdOrder.id, status: createdOrder.status });
    if (buyerId) emitToUser(buyerId, "order.updated", { orderId: createdOrder.id, status: createdOrder.status });
  }
  if (status === "Confirmed") emitToAll("catalog.updated", { shopId: String(shopId) });
  return result;
}

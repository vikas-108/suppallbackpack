import mongoose from "mongoose";
import Notification from "../models/Notification.js";
import { emitToShop, emitToUser } from "./realtimeService.js";
import { ApiError } from "../utils/apiError.js";

function serializeNotification(notification, userId) {
  const readBy = notification.readBy || [];
  return {
    id: String(notification._id),
    kind: notification.kind,
    title: notification.title,
    message: notification.message,
    href: notification.href,
    relatedId: notification.relatedId || "",
    createdAt: notification.createdAt.toISOString(),
    read: userId ? readBy.some(id => String(id) === String(userId)) : false
  };
}

export async function createShopNotification({
  shopId,
  kind,
  title,
  message,
  href,
  relatedId = "",
  event,
  eventData = {}
}) {
  try {
    const notification = await Notification.create({
      shopId,
      kind,
      title,
      message,
      href,
      relatedId
    });
    emitToShop(shopId, "notification.created", serializeNotification(notification));
  } catch (error) {
    console.error("Could not persist a shop notification.", {
      code: error.code || "NOTIFICATION_WRITE_FAILED",
      kind,
      shopId: String(shopId)
    });
  }
  if (event) emitToShop(shopId, event, eventData);
}

export async function listNotifications(shopId, userId) {
  const [notifications, unreadCount] = await Promise.all([
    Notification.find({ shopId }).sort({ createdAt: -1 }).limit(100),
    Notification.countDocuments({ shopId, readBy: { $ne: userId } })
  ]);
  return {
    notifications: notifications.map(notification => serializeNotification(notification, userId)),
    unreadCount
  };
}

export async function markNotificationRead(shopId, userId, notificationId) {
  if (!mongoose.isValidObjectId(notificationId)) {
    throw new ApiError(400, "Invalid notification.", "INVALID_ID");
  }
  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, shopId },
    { $addToSet: { readBy: userId } },
    { new: true }
  );
  if (!notification) throw new ApiError(404, "Notification not found.", "NOTIFICATION_NOT_FOUND");
  const serialized = serializeNotification(notification, userId);
  emitToUser(userId, "notifications.read", { notificationId: serialized.id });
  return serialized;
}

export async function markAllNotificationsRead(shopId, userId) {
  await Notification.updateMany(
    { shopId, readBy: { $ne: userId } },
    { $addToSet: { readBy: userId } }
  );
  const result = await listNotifications(shopId, userId);
  emitToUser(userId, "notifications.read-all", { unreadCount: result.unreadCount });
  return result;
}

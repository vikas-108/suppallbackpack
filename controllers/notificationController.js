import { getShopId } from "../services/shopService.js";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../services/notificationService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";

export const getNotifications = asyncHandler(async (req, res) => {
  sendData(res, await listNotifications(getShopId(req.user), req.user._id));
});

export const readNotification = asyncHandler(async (req, res) => {
  const notification = await markNotificationRead(
    getShopId(req.user),
    req.user._id,
    req.params.notificationId
  );
  sendData(res, { notification });
});

export const readAllNotifications = asyncHandler(async (req, res) => {
  sendData(res, await markAllNotificationsRead(getShopId(req.user), req.user._id));
});

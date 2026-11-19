import { createBooking, listShopBookings, updateBookingStatus } from "../services/bookingService.js";
import { getShopId } from "../services/shopService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import { bookingSchema, bookingStatusSchema } from "../utils/validation.js";

export const submitBooking = asyncHandler(async (req, res) => {
  const data = bookingSchema.parse(req.body);
  sendData(res, { booking: await createBooking(data, req.user?._id) }, 201);
});

export const getBookings = asyncHandler(async (req, res) => {
  sendData(res, { bookings: await listShopBookings(getShopId(req.user)) });
});

export const updateBooking = asyncHandler(async (req, res) => {
  const { status } = bookingStatusSchema.parse(req.body);
  const booking = await updateBookingStatus(getShopId(req.user), req.params.bookingNumber, status, req.user);
  sendData(res, { booking });
});

import { createImageUploadSignature } from "../services/cloudinaryService.js";
import { getShopId } from "../services/shopService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";

export const signProductUpload = asyncHandler(async (req, res) => {
  sendData(res, createImageUploadSignature(getShopId(req.user)));
});

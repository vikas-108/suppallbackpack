import { getAddress, saveAddress } from "../services/addressService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";
import { addressSchema } from "../utils/validation.js";

export const getMyAddress = asyncHandler(async (req, res) => {
  sendData(res, { address: await getAddress(req.user._id) });
});

export const saveMyAddress = asyncHandler(async (req, res) => {
  const data = addressSchema.parse(req.body);
  sendData(res, { address: await saveAddress(req.user._id, data) });
});

import { Router } from "express";
import { getPlatformFee } from "../services/platformFeeService.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { sendData } from "../utils/response.js";

const router = Router();

router.get("/", asyncHandler(async (_req, res) => {
  sendData(res, { platformFee: await getPlatformFee() });
}));

export default router;

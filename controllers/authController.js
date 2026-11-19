import { acceptCurrentTerms, authenticate, registerBuyer } from "../services/authService.js";
import { clearSessionCookie, setSessionCookie } from "../middleware/auth.js";
import { sendData } from "../utils/response.js";
import { serializeUser } from "../utils/serializers.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  buyerRegistrationSchema,
  inactivityPreferenceSchema,
  loginSchema,
  termsAcceptanceSchema
} from "../utils/validation.js";
import { createRealtimeToken } from "../services/realtimeService.js";
import { getShopId } from "../services/shopService.js";
import { getInactivityPreference, saveInactivityPreference } from "../services/accountSettingsService.js";

export const login = asyncHandler(async (req, res) => {
  const data = loginSchema.parse(req.body);
  const user = await authenticate(data);
  setSessionCookie(res, user._id);
  sendData(res, { user: serializeUser(user) });
});

export const register = asyncHandler(async (req, res) => {
  const data = buyerRegistrationSchema.parse(req.body);
  const user = await registerBuyer(data);
  setSessionCookie(res, user._id);
  sendData(res, { user: serializeUser(user) }, 201);
});

export const currentUser = asyncHandler(async (req, res) => {
  sendData(res, { user: serializeUser(req.user) });
});

export const acceptTerms = asyncHandler(async (req, res) => {
  termsAcceptanceSchema.parse(req.body);
  sendData(res, await acceptCurrentTerms(req.user));
});

export const getMyInactivityPreference = asyncHandler(async (req, res) => {
  sendData(res, await getInactivityPreference(req.user));
});

export const updateMyInactivityPreference = asyncHandler(async (req, res) => {
  const preference = inactivityPreferenceSchema.parse(req.body);
  sendData(res, await saveInactivityPreference(req.user._id, preference));
});

export const realtimeToken = asyncHandler(async (req, res) => {
  if (req.user.role !== "buyer") getShopId(req.user);
  sendData(res, { token: createRealtimeToken(req.user) });
});

export const logout = asyncHandler(async (_req, res) => {
  clearSessionCookie(res);
  sendData(res, { signedOut: true });
});

import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import User from "../models/User.js";
import { ApiError } from "../utils/apiError.js";
import { normalizePhone } from "../utils/phone.js";
import { TERMS_VERSION } from "../utils/terms.js";

const passwordRounds = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, passwordRounds);
}

export async function registerBuyer(data) {
  const phone = normalizePhone(data.countryCode, data.phone);
  const passwordHash = await hashPassword(data.password);
  return User.create({
    name: data.name,
    countryCode: data.countryCode,
    phone,
    passwordHash,
    termsAcceptedAt: new Date(),
    termsVersion: TERMS_VERSION,
    role: "buyer"
  });
}

export async function acceptCurrentTerms(user) {
  user.termsAcceptedAt = new Date();
  user.termsVersion = TERMS_VERSION;
  await user.save();
  return { accepted: true, acceptedAt: user.termsAcceptedAt, version: user.termsVersion };
}

export async function authenticate(credentials) {
  const phone = normalizePhone(credentials.countryCode, credentials.phone);
  const user = await User.findOne({
    countryCode: credentials.countryCode,
    phone
  }).select("+passwordHash");

  if (!user || !user.isActive || !(await bcrypt.compare(credentials.password, user.passwordHash))) {
    throw new ApiError(401, "The phone number or password is incorrect, or the account is inactive.", "INVALID_CREDENTIALS");
  }
  user.lastLoginAt = new Date();
  await user.save();
  return user;
}

export function signSession(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: "8h",
    issuer: "buildsupply",
    audience: "buildsupply-web"
  });
}

import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { hasAcceptedCurrentTerms } from "../utils/terms.js";

export function setSessionCookie(res, userId) {
  const token = jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: "8h",
    issuer: "buildsupply",
    audience: "buildsupply-web"
  });
  res.cookie(env.cookieName, token, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60 * 1000
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, {
    httpOnly: true,
    secure: env.isProduction,
    sameSite: "lax",
    path: "/"
  });
}

export const requireAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies[env.cookieName];
  if (!token) throw new ApiError(401, "Sign in to continue.", "AUTHENTICATION_REQUIRED");
  let claims;
  try {
    claims = jwt.verify(token, env.jwtSecret, {
      issuer: "buildsupply",
      audience: "buildsupply-web"
    });
  } catch {
    clearSessionCookie(res);
    throw new ApiError(401, "Your session has expired. Sign in again.", "SESSION_EXPIRED");
  }
  const user = await User.findById(claims.sub);
  if (!user || !user.isActive) {
    clearSessionCookie(res);
    throw new ApiError(403, "This account is inactive. Contact the shop owner.", "ACCOUNT_INACTIVE");
  }
  req.user = user;
  const isTermsEndpoint = req.baseUrl === "/api/auth" && req.method === "POST" && req.path === "/accept-terms";
  const isCurrentUserEndpoint = req.baseUrl === "/api/auth" && req.method === "GET" && req.path === "/me";
  if (!hasAcceptedCurrentTerms(user) && !isTermsEndpoint && !isCurrentUserEndpoint) {
    throw new ApiError(403, "Please review and accept the current Terms & Conditions to continue.", "TERMS_ACCEPTANCE_REQUIRED");
  }
  next();
});

export const optionalAuth = asyncHandler(async (req, res, next) => {
  const token = req.cookies[env.cookieName];
  if (!token) return next();
  let claims;
  try {
    claims = jwt.verify(token, env.jwtSecret, {
      issuer: "buildsupply",
      audience: "buildsupply-web"
    });
  } catch {
    clearSessionCookie(res);
    return next();
  }
  const user = await User.findById(claims.sub);
  if (user?.isActive) req.user = user;
  else clearSessionCookie(res);
  if (req.user && !hasAcceptedCurrentTerms(req.user)) {
    throw new ApiError(403, "Please review and accept the current Terms & Conditions to continue.", "TERMS_ACCEPTANCE_REQUIRED");
  }
  next();
});

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new ApiError(403, "You do not have permission to perform this action.", "FORBIDDEN"));
    }
    next();
  };
}

import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

export function sameOriginJson(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();

  const origin = req.get("origin");
  if (origin) {
    let requestOrigin;
    try {
      requestOrigin = new URL(origin).origin;
    } catch {
      return next(new ApiError(403, "Cross-origin changes are not allowed.", "INVALID_ORIGIN"));
    }
    if (requestOrigin !== new URL(env.appOrigin).origin) {
      return next(new ApiError(403, "Cross-origin changes are not allowed.", "INVALID_ORIGIN"));
    }
  }
  if (req.get("sec-fetch-site") === "cross-site") {
    return next(new ApiError(403, "Cross-site changes are not allowed.", "INVALID_ORIGIN"));
  }
  if (!req.is("application/json")) {
    return next(new ApiError(415, "API changes must use application/json.", "JSON_REQUIRED"));
  }
  next();
}

export function allowConfiguredOrigin(req, res, next) {
  const origin = req.get("origin");
  if (!origin) return next();

  let requestOrigin;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return next();
  }
  if (requestOrigin !== new URL(env.appOrigin).origin) return next();

  res.setHeader("Access-Control-Allow-Origin", requestOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.vary("Origin");

  if (req.method !== "OPTIONS") return next();
  const requestedMethod = req.get("access-control-request-method");
  const allowedMethods = ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"];
  if (requestedMethod && !allowedMethods.includes(requestedMethod.toUpperCase())) {
    return res.sendStatus(405);
  }

  const requestedHeaders = (req.get("access-control-request-headers") || "")
    .split(",")
    .map(header => header.trim().toLowerCase())
    .filter(Boolean);
  if (requestedHeaders.some(header => header !== "content-type")) return res.sendStatus(403);

  res.setHeader("Access-Control-Allow-Methods", allowedMethods.join(", "));
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  return res.sendStatus(204);
}

export function hideServerFiles(req, res, next) {
  if (/^\/(?:backend|node_modules|\.env)(?:\/|$)/i.test(req.path)) {
    return res.sendStatus(404);
  }
  next();
}

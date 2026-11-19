import { ZodError } from "zod";
import { ApiError } from "../utils/apiError.js";

export function notFound(req, res, next) {
  if (req.originalUrl === "/api" || req.originalUrl.startsWith("/api/")) {
    return next(new ApiError(404, "API route not found.", "ROUTE_NOT_FOUND"));
  }
  res.status(404).send("Page not found.");
}

export function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  if (error instanceof ZodError) {
    const first = error.issues[0];
    return res.status(400).json({
      error: {
        code: "VALIDATION_FAILED",
        message: first?.message || "Check the submitted fields.",
        field: first?.path.join(".") || ""
      }
    });
  }
  if (error?.code === 11000) {
    return res.status(409).json({
      error: {
        code: "DUPLICATE_RECORD",
        message: "That phone number, email, or shop is already registered."
      }
    });
  }
  if (error?.name === "ValidationError") {
    return res.status(400).json({
      error: { code: "VALIDATION_FAILED", message: "The submitted data is invalid." }
    });
  }
  if (error?.name === "CastError") {
    return res.status(400).json({ error: { code: "INVALID_ID", message: "The requested record is invalid." } });
  }

  const status = error instanceof ApiError ? error.status : 500;
  const code = error instanceof ApiError ? error.code : "INTERNAL_ERROR";
  if (!(error instanceof ApiError)) {
    console.error("API request failed.", {
      method: req.method,
      path: req.path,
      errorName: error?.name || "Error"
    });
  }
  return res.status(status).json({
    error: {
      code,
      message: error instanceof ApiError ? error.message : "The server could not complete this request."
    }
  });
}

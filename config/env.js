import dotenv from "dotenv";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const projectEnvPath = fileURLToPath(new URL("../../.env", import.meta.url));
const backendEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
dotenv.config({ path: existsSync(projectEnvPath) ? projectEnvPath : backendEnvPath });

const isProduction = process.env.NODE_ENV === "production";

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV || "development",
  isProduction,
  port: Number(process.env.PORT || 3000),
  mongoUri: process.env.MONGODB_URI || "",
  jwtSecret: process.env.JWT_SECRET || "",
  adminCountryCode: process.env.ADMIN_COUNTRY_CODE || "",
  adminPhone: process.env.ADMIN_PHONE || "",
  appOrigin: process.env.APP_ORIGIN || "http://127.0.0.1:5500",
  cookieName: "buildsupply_session",
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || "",
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || ""
});

export function assertRuntimeConfig() {
  const missing = [];
  if (!env.mongoUri) missing.push("MONGODB_URI");
  if (!env.jwtSecret) missing.push("JWT_SECRET");
  if (env.jwtSecret && env.jwtSecret.length < 48) {
    throw new Error("JWT_SECRET must be at least 48 characters; generate a random secret.");
  }
  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}.`);
  }
  let origin;
  try {
    origin = new URL(env.appOrigin);
  } catch {
    throw new Error("APP_ORIGIN must be a valid absolute URL.");
  }
  if (env.isProduction && origin.protocol !== "https:") {
    throw new Error("APP_ORIGIN must use HTTPS in production.");
  }
  if (env.isProduction && !env.mongoUri.startsWith("mongodb+srv://")) {
    throw new Error("Production MONGODB_URI must use the TLS-enabled MongoDB Atlas mongodb+srv scheme.");
  }
}

export function assertCloudinaryConfig() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new Error("Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET.");
  }
}

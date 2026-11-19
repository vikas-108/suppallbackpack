import { createHash, randomUUID } from "node:crypto";
import { env } from "../config/env.js";
import { ApiError } from "../utils/apiError.js";

function cloudinaryConfig() {
  if (!env.cloudinaryCloudName || !env.cloudinaryApiKey || !env.cloudinaryApiSecret) {
    throw new ApiError(503, "Product image uploads are not configured. Set the Cloudinary environment variables.", "CLOUDINARY_NOT_CONFIGURED");
  }
}

function signatureFor(parameters) {
  const serialized = Object.entries(parameters)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return createHash("sha1").update(`${serialized}${env.cloudinaryApiSecret}`).digest("hex");
}

export function createImageUploadSignature(shopId) {
  cloudinaryConfig();
  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = `buildsupply/products/${shopId}/${randomUUID()}`;
  const parameters = { public_id: publicId, timestamp };
  return {
    cloudName: env.cloudinaryCloudName,
    apiKey: env.cloudinaryApiKey,
    timestamp,
    publicId,
    signature: signatureFor(parameters)
  };
}

export async function deleteProductImage(shopId, publicId) {
  cloudinaryConfig();
  const prefix = `buildsupply/products/${shopId}/`;
  if (!publicId.startsWith(prefix)) {
    throw new ApiError(403, "The image does not belong to this shop.", "IMAGE_OWNERSHIP_MISMATCH");
  }
  const timestamp = Math.floor(Date.now() / 1000);
  const parameters = { invalidate: true, public_id: publicId, timestamp };
  const body = new URLSearchParams({
    ...parameters,
    api_key: env.cloudinaryApiKey,
    signature: signatureFor(parameters)
  });

  let response;
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${env.cloudinaryCloudName}/image/destroy`, {
      method: "POST",
      body,
      signal: AbortSignal.timeout(10000)
    });
  } catch {
    throw new ApiError(502, "Cloudinary could not be reached to remove the product image.", "CLOUDINARY_UNAVAILABLE");
  }
  if (!response.ok) throw new ApiError(502, "Cloudinary rejected the product image removal.", "CLOUDINARY_DELETE_FAILED");
  const result = await response.json();
  if (!["ok", "not found"].includes(result.result)) {
    throw new ApiError(502, "Cloudinary did not confirm the product image removal.", "CLOUDINARY_DELETE_FAILED");
  }
}

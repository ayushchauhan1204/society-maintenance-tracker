import crypto from "crypto";
import { ALLOWED_PHOTO_FORMATS } from "@/lib/constants/uploads";

export interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
}

// Cloudinary's signing algorithm: sort every parameter that will be sent
// (except file/cloud_name/api_key/resource_type) alphabetically by key,
// join as key=value pairs, append the API secret, then SHA-1 hex-digest.
// See https://cloudinary.com/documentation/authentication_signatures.
function signParams(params: Record<string, string | number>, apiSecret: string): string {
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
  return crypto.createHash("sha1").update(canonical + apiSecret).digest("hex");
}

// Signs a direct-to-Cloudinary upload — the server vouches for one upload's
// parameters but never touches the image bytes themselves. The browser
// uploads straight to Cloudinary with these params; only the resulting
// public_id/url ever reach our API. See ARCHITECTURE.md.
export function createSignedUpload(): SignedUpload {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary is not configured");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "society-maintenance/complaints";
  const paramsToSign = { timestamp, folder, allowed_formats: ALLOWED_PHOTO_FORMATS };

  return {
    cloudName,
    apiKey,
    timestamp,
    folder,
    allowedFormats: ALLOWED_PHOTO_FORMATS,
    signature: signParams(paramsToSign, apiSecret),
  };
}

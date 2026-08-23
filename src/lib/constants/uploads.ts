// Shared between the Zod schema (server) and the upload form (client), so
// both enforce the same limits and the client can fail fast before ever
// hitting the network.
export const ALLOWED_PHOTO_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const ALLOWED_PHOTO_FORMATS = "jpg,png,webp,gif";
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

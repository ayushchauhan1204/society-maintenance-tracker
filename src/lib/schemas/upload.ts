import { z } from "zod";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from "@/lib/constants/uploads";

// Validated before signing — see lib/uploads/cloudinary.ts and
// ARCHITECTURE.md ("the server never proxies image bytes").
export const signUploadSchema = z.object({
  mimeType: z.enum(ALLOWED_PHOTO_MIME_TYPES),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(MAX_PHOTO_BYTES, `Photo must be ${MAX_PHOTO_BYTES / (1024 * 1024)}MB or smaller`),
});

export type SignUploadInput = z.infer<typeof signUploadSchema>;

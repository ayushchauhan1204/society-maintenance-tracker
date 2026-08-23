import { z } from "zod";
import { Category } from "@prisma/client";

export const createComplaintSchema = z.object({
  category: z.nativeEnum(Category),
  description: z.string().trim().min(10).max(2000),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

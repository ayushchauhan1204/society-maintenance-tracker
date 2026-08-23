import { z } from "zod";

export const createNoticeSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(5000),
  isImportant: z.boolean().default(false),
});

export type CreateNoticeInput = z.infer<typeof createNoticeSchema>;

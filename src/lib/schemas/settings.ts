import { z } from "zod";
import { Category, Priority } from "@prisma/client";

// The full matrix, always sent together — one row per (category, priority)
// combination, 8 categories x 3 priorities. hours must be a positive
// integer: non-positive values are rejected here, at the boundary.
export const slaMatrixUpdateSchema = z.object({
  policies: z
    .array(
      z.object({
        category: z.nativeEnum(Category),
        priority: z.nativeEnum(Priority),
        hours: z.number().int().positive(),
      }),
    )
    .length(24),
});

export type SlaMatrixUpdateInput = z.infer<typeof slaMatrixUpdateSchema>;

export const recurrenceSettingsUpdateSchema = z.object({
  recurrenceWindowDays: z.number().int().positive(),
  recurrenceThresholdCount: z.number().int().positive(),
});

export type RecurrenceSettingsUpdateInput = z.infer<typeof recurrenceSettingsUpdateSchema>;

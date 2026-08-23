import { z } from "zod";
import { Category, Priority, Status } from "@prisma/client";

export const createComplaintSchema = z.object({
  category: z.nativeEnum(Category),
  description: z.string().trim().min(10).max(2000),
});

export type CreateComplaintInput = z.infer<typeof createComplaintSchema>;

// Query-string filters for the admin queue. Composes with the overdue sort —
// filtering never bypasses it.
export const adminQueueFilterSchema = z.object({
  category: z.nativeEnum(Category).optional(),
  status: z.nativeEnum(Status).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
});

export type AdminQueueFilters = z.infer<typeof adminQueueFilterSchema>;

// Mirrors the `kind` variants of ApplyTransitionInput (lib/complaints/transition.ts)
// minus the fields the server supplies itself (complaintId from the route,
// actorId from the session). expectedVersion is always required — see
// ARCHITECTURE.md, invariant 6.
const noteField = z.string().trim().max(2000).optional();

export const adminActionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("STATUS_CHANGE"),
    toStatus: z.nativeEnum(Status),
    note: noteField,
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("PRIORITY_CHANGE"),
    toPriority: z.nativeEnum(Priority),
    note: noteField,
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("ESCALATE"),
    note: noteField,
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("DEESCALATE"),
    note: noteField,
    expectedVersion: z.number().int().nonnegative(),
  }),
  z.object({
    kind: z.literal("NOTE"),
    note: z.string().trim().min(1).max(2000),
    expectedVersion: z.number().int().nonnegative(),
  }),
]);

export type AdminActionInput = z.infer<typeof adminActionSchema>;

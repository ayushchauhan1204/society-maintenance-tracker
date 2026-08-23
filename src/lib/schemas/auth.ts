import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Registration is resident-only — admins are seeded, never self-registered.
// The unit must be picked from the existing set, not typed freely.
export const registerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
  unitId: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;

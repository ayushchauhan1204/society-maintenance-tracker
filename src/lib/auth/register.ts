import { Prisma, Role, type User } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/client";
import type { RegisterInput } from "@/lib/schemas/auth";

export class EmailInUseError extends Error {
  constructor(public readonly email: string) {
    super(`Email ${email} is already registered`);
    this.name = "EmailInUseError";
  }
}

export class UnitNotFoundError extends Error {
  constructor(public readonly unitId: string) {
    super(`Unit ${unitId} does not exist`);
    this.name = "UnitNotFoundError";
  }
}

// Residents self-register into an existing unit. Admins are seeded, never
// created through this path — there is no role field to set here.
export async function registerResident(input: RegisterInput): Promise<User> {
  const passwordHash = await bcrypt.hash(input.password, 10);

  try {
    return await prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: Role.RESIDENT,
        unitId: input.unitId,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2002") {
        throw new EmailInUseError(input.email);
      }
      if (err.code === "P2003") {
        throw new UnitNotFoundError(input.unitId);
      }
    }
    throw err;
  }
}

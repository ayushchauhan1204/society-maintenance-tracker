import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

// Session carries userId, role, and unitId so lib/db/scopes.ts can build
// authorization into every query without a handler-level role check.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: Role;
      unitId: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    id: string;
    role: Role;
    unitId: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    role: Role;
    unitId: string | null;
  }
}

import { Prisma, Role } from "@prisma/client";
import type { Session } from "next-auth";

// Authorization lives here, not in handlers. See ARCHITECTURE.md, invariant 5.
//
// Every query a resident can run is built by one of these functions. A
// resident requesting another resident's complaint ID gets a where clause
// that never matches that row — a 404, not a caught-in-the-act 403.

export class UnauthenticatedError extends Error {
  constructor() {
    super("No active session");
    this.name = "UnauthenticatedError";
  }
}

export class UnauthorizedError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnauthorizedError";
  }
}

function requireSession(session: Session | null): Session {
  if (!session) {
    throw new UnauthenticatedError();
  }
  return session;
}

// Scopes a complaint read (list or single) to complaints raised by this
// resident. `extra` narrows further (e.g. by id) without ever widening past
// the resident's own rows.
export function residentComplaintScope(
  session: Session | null,
  extra: Prisma.ComplaintWhereInput = {},
): Prisma.ComplaintWhereInput {
  const activeSession = requireSession(session);
  if (activeSession.user.role !== Role.RESIDENT) {
    throw new UnauthorizedError("residentComplaintScope requires a RESIDENT session");
  }
  return { ...extra, raisedById: activeSession.user.id };
}

// Scopes complaint creation to the resident's own identity and unit — a
// resident can never raise a complaint as someone else or for another unit.
export function residentComplaintCreateScope(
  session: Session | null,
): { raisedById: string; unitId: string } {
  const activeSession = requireSession(session);
  if (activeSession.user.role !== Role.RESIDENT || !activeSession.user.unitId) {
    throw new UnauthorizedError("residentComplaintCreateScope requires a RESIDENT session with a unit");
  }
  return { raisedById: activeSession.user.id, unitId: activeSession.user.unitId };
}

// Gates admin-only access. Unlike the resident scopes, an admin's queries
// aren't narrowed to a subset of rows — the gate itself *is* the scope.
export function requireAdmin(session: Session | null): Session {
  const activeSession = requireSession(session);
  if (activeSession.user.role !== Role.ADMIN) {
    throw new UnauthorizedError("This action requires an ADMIN session");
  }
  return activeSession;
}

// Scopes a single-complaint admin read. `extra` narrows the lookup (e.g. by
// id); admins are never restricted to a subset of complaints the way
// residents are, but the authorization decision still lives here, not in
// the handler or page that calls it.
export function adminComplaintScope(
  session: Session | null,
  extra: Prisma.ComplaintWhereInput = {},
): Prisma.ComplaintWhereInput {
  requireAdmin(session);
  return { ...extra };
}

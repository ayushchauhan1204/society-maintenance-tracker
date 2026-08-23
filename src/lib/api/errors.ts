import { NextResponse } from "next/server";
import { UnauthenticatedError, UnauthorizedError } from "@/lib/db/scopes";

// Translates errors thrown by lib/ functions into HTTP responses. This is not
// a role check — the scoping helpers in lib/db/scopes.ts already decided
// who's allowed to do what; this only maps their verdict to a status code.
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof UnauthenticatedError) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  if (err instanceof UnauthorizedError) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  throw err;
}

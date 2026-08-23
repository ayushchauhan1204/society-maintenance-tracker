import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { requireAdmin, UnauthenticatedError, UnauthorizedError } from "@/lib/db/scopes";
import { adminActionSchema } from "@/lib/schemas/complaint";
import {
  applyTransition,
  ComplaintNotFoundError,
  IllegalTransitionError,
  ConcurrencyError,
} from "@/lib/complaints/transition";
import { nudgeOutboxDrain } from "@/lib/outbox/nudge";

// Every admin action goes through applyTransition() with the client's last
// known version. A version mismatch is a 409, not a silent overwrite. See
// ARCHITECTURE.md, invariants 1, 2, and 6.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json().catch(() => null);
  const parsed = adminActionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const admin = requireAdmin(session);

    const { expectedVersion, ...action } = parsed.data;
    const updated = await applyTransition({
      ...action,
      complaintId: params.id,
      actorId: admin.user.id,
      expectedVersion,
    });

    // Only STATUS_CHANGE enqueues an outbox row (see transition.ts) — nudge
    // the drain worker so the resident's email arrives without anyone
    // clicking the manual trigger. Fire-and-forget: this never blocks or
    // fails the response above.
    if (action.kind === "STATUS_CHANGE") {
      nudgeOutboxDrain(admin);
    }

    return NextResponse.json(updated);
  } catch (err) {
    if (err instanceof UnauthenticatedError) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    if (err instanceof UnauthorizedError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (err instanceof ComplaintNotFoundError) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (err instanceof IllegalTransitionError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    if (err instanceof ConcurrencyError) {
      return NextResponse.json(
        {
          error: "Someone else updated this complaint. Refresh and try again.",
          currentState: err.currentState,
        },
        { status: 409 },
      );
    }
    throw err;
  }
}

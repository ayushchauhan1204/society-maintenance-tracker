import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { errorResponse } from "@/lib/api/errors";
import { drainOutbox } from "@/lib/outbox/drain";

// Manual trigger so the drain worker can be demoed without a cron job. No
// email is ever sent inline from a request handler that changes state —
// this route's only job IS sending queued mail. See ARCHITECTURE.md,
// invariant 4.
export async function POST() {
  try {
    const session = await getServerSession(authOptions);
    const result = await drainOutbox(session);
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}

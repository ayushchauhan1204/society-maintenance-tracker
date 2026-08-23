import { waitUntil } from "@vercel/functions";
import type { Session } from "next-auth";
import { drainOutbox } from "@/lib/outbox/drain";

// Fires the drain worker in the background right after a mutation enqueues
// outbox messages, so a status change or an important notice shows up in a
// reviewer's inbox without anyone clicking the manual "Send pending emails"
// trigger on /admin/system. Never awaited, and never allowed to fail the
// request that triggered it — the handler still only enqueues; this just
// nudges the worker that already exists to send. See ARCHITECTURE.md,
// invariant 4.
//
// waitUntil() keeps the serverless function alive for this one promise
// without blocking the response. A bare fire-and-forget call (no waitUntil)
// looks fine in local dev, where the Node process just keeps running, but
// is not guaranteed to complete on Vercel — the function can freeze the
// instant the response is sent.
export function nudgeOutboxDrain(session: Session | null): void {
  waitUntil(
    drainOutbox(session).catch(() => {
      // Best-effort. If this fails — a down mail provider, a stale
      // session — the messages stay PENDING and the next nudge, or the
      // manual trigger, remains the fallback. Never surfaces to the caller.
    }),
  );
}

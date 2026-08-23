import { OutboxStatus } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";
import { sendMail } from "@/lib/outbox/mailer";

const BATCH_SIZE = 25;
const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MINUTES = 5;

export interface DrainResult {
  sent: number;
  retried: number;
  failed: number;
}

// Claims PENDING messages due now and sends them one at a time, committing
// each message's outcome (SENT, rescheduled, or FAILED) independently as it
// goes. Never wrapped in a single transaction across the batch — a failing
// mail provider must never fail a status update or roll one back, and one
// message's failure must never block or undo another's success. See
// ARCHITECTURE.md, invariant 4.
export async function drainOutbox(session: Session | null): Promise<DrainResult> {
  requireAdmin(session);

  const now = new Date();
  const messages = await prisma.outboxMessage.findMany({
    where: { status: OutboxStatus.PENDING, nextAttemptAt: { lte: now } },
    orderBy: { nextAttemptAt: "asc" },
    take: BATCH_SIZE,
  });

  const result: DrainResult = { sent: 0, retried: 0, failed: 0 };

  for (const message of messages) {
    try {
      await sendMail(message);
      await prisma.outboxMessage.update({
        where: { id: message.id },
        data: { status: OutboxStatus.SENT, sentAt: new Date() },
      });
      result.sent += 1;
    } catch (err) {
      const attempts = message.attempts + 1;
      const lastError = err instanceof Error ? err.message : String(err);

      if (attempts >= MAX_ATTEMPTS) {
        await prisma.outboxMessage.update({
          where: { id: message.id },
          data: { status: OutboxStatus.FAILED, attempts, lastError },
        });
        result.failed += 1;
      } else {
        const backoffMinutes = BASE_BACKOFF_MINUTES * 2 ** (attempts - 1);
        await prisma.outboxMessage.update({
          where: { id: message.id },
          data: { attempts, lastError, nextAttemptAt: new Date(Date.now() + backoffMinutes * 60 * 1000) },
        });
        result.retried += 1;
      }
    }
  }

  return result;
}

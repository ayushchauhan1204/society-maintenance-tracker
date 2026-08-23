import { OutboxStatus } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";

export interface OutboxSummary {
  pending: number;
  sent: number;
  failed: number;
}

export async function getOutboxSummary(session: Session | null): Promise<OutboxSummary> {
  requireAdmin(session);

  const [pending, sent, failed] = await Promise.all([
    prisma.outboxMessage.count({ where: { status: OutboxStatus.PENDING } }),
    prisma.outboxMessage.count({ where: { status: OutboxStatus.SENT } }),
    prisma.outboxMessage.count({ where: { status: OutboxStatus.FAILED } }),
  ]);

  return { pending, sent, failed };
}

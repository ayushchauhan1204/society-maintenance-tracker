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

  const counts = await prisma.outboxMessage.groupBy({ by: ["status"], _count: { _all: true } });
  const byStatus = new Map(counts.map((row) => [row.status, row._count._all]));

  return {
    pending: byStatus.get(OutboxStatus.PENDING) ?? 0,
    sent: byStatus.get(OutboxStatus.SENT) ?? 0,
    failed: byStatus.get(OutboxStatus.FAILED) ?? 0,
  };
}

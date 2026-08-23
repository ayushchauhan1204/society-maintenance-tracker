import { Prisma, type Category } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";
import { getRecurrenceSettings } from "@/lib/settings/queries";

export interface RecurrenceGroup {
  unitLabel: string;
  category: Category;
  count: number;
  spanDays: number;
}

interface RecurrenceRow {
  unitLabel: string;
  category: Category;
  count: bigint;
  firstCreatedAt: Date;
  lastCreatedAt: Date;
}

// Recurring: >= N complaints, same (unitId, category), within the
// recurrence window — N and the window are admin-editable via Setting, and
// this is recomputed at read time, never stored. See ARCHITECTURE.md.
export async function listRecurrenceGroups(session: Session | null): Promise<RecurrenceGroup[]> {
  requireAdmin(session);

  const { windowDays, thresholdCount } = await getRecurrenceSettings();
  const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const rows = await prisma.$queryRaw<RecurrenceRow[]>(Prisma.sql`
    SELECT
      u."label" AS "unitLabel",
      c."category" AS "category",
      COUNT(*) AS "count",
      MIN(c."createdAt") AS "firstCreatedAt",
      MAX(c."createdAt") AS "lastCreatedAt"
    FROM "Complaint" c
    JOIN "Unit" u ON u."id" = c."unitId"
    WHERE c."createdAt" >= ${windowStart}
    GROUP BY u."label", c."category"
    HAVING COUNT(*) >= ${thresholdCount}
    ORDER BY COUNT(*) DESC, MAX(c."createdAt") DESC
  `);

  return rows.map((row) => ({
    unitLabel: row.unitLabel,
    category: row.category,
    count: Number(row.count),
    spanDays: Math.round((row.lastCreatedAt.getTime() - row.firstCreatedAt.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

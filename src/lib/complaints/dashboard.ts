import { Prisma, Status, Category } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";

export interface DashboardStats {
  total: number;
  byStatus: Record<Status, number>;
  byCategory: Record<Category, number>;
  overdueCount: number;
  regressionCount: number;
}

interface OverdueRegressionRow {
  overdueCount: bigint;
  regressionCount: bigint;
}

// Two queries total, not one count per status/category/overdue/regression:
// a single groupBy for the status x category breakdown, and a single raw-SQL
// pass (joining SlaPolicy, since overdue is never stored — see invariant 3)
// for the overdue and regression counts together.
export async function getDashboardStats(session: Session | null): Promise<DashboardStats> {
  requireAdmin(session);

  const grouped = await prisma.complaint.groupBy({
    by: ["status", "category"],
    _count: { _all: true },
  });

  const byStatus = Object.fromEntries(Object.values(Status).map((status) => [status, 0])) as Record<
    Status,
    number
  >;
  const byCategory = Object.fromEntries(Object.values(Category).map((category) => [category, 0])) as Record<
    Category,
    number
  >;
  let total = 0;

  for (const row of grouped) {
    byStatus[row.status] += row._count._all;
    byCategory[row.category] += row._count._all;
    total += row._count._all;
  }

  const [{ overdueCount, regressionCount }] = await prisma.$queryRaw<OverdueRegressionRow[]>(Prisma.sql`
    SELECT
      COUNT(*) FILTER (
        WHERE c."status" != 'RESOLVED'
          AND sp."hours" IS NOT NULL
          AND EXTRACT(EPOCH FROM (now() - c."createdAt")) / 3600.0 > sp."hours"
      ) AS "overdueCount",
      COUNT(*) FILTER (WHERE c."regressedFromId" IS NOT NULL) AS "regressionCount"
    FROM "Complaint" c
    LEFT JOIN "SlaPolicy" sp ON sp."category" = c."category" AND sp."priority" = c."priority"
  `);

  return {
    total,
    byStatus,
    byCategory,
    overdueCount: Number(overdueCount),
    regressionCount: Number(regressionCount),
  };
}

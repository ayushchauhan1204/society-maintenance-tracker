import { Prisma, type Category, type Priority, type Status } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";
import type { AdminQueueFilters } from "@/lib/schemas/complaint";

export interface AdminQueueRow {
  id: string;
  category: Category;
  description: string;
  status: Status;
  priority: Priority;
  isEscalated: boolean;
  createdAt: Date;
  lastActivityAt: Date;
  version: number;
  unitLabel: string;
  residentName: string;
  residentEmail: string;
  slaHours: number | null;
  hoursOpen: number;
  isOverdue: boolean;
}

// Overdue is never stored — this joins SlaPolicy on (category, priority) and
// computes it at read time. See ARCHITECTURE.md, invariant 3.
//
// Sort: overdue first, then escalated, then priority (HIGH > MEDIUM > LOW),
// then oldest first. Filters narrow the WHERE clause but never touch the
// ORDER BY, so the overdue sort always applies on top of them.
export async function listAdminQueue(
  session: Session | null,
  filters: AdminQueueFilters,
): Promise<AdminQueueRow[]> {
  requireAdmin(session);

  const conditions: Prisma.Sql[] = [];

  if (filters.category) {
    conditions.push(Prisma.sql`c."category" = ${filters.category}::"Category"`);
  }
  if (filters.status) {
    conditions.push(Prisma.sql`c."status" = ${filters.status}::"Status"`);
  }
  if (filters.from) {
    conditions.push(Prisma.sql`c."createdAt" >= ${filters.from}`);
  }
  if (filters.to) {
    // Inclusive of the whole end date: filter up to (but not including) the
    // following day rather than midnight of the day itself.
    const exclusiveEnd = new Date(filters.to);
    exclusiveEnd.setUTCDate(exclusiveEnd.getUTCDate() + 1);
    conditions.push(Prisma.sql`c."createdAt" < ${exclusiveEnd}`);
  }

  const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, " AND ")}` : Prisma.empty;

  return prisma.$queryRaw<AdminQueueRow[]>(Prisma.sql`
    SELECT
      c."id" AS "id",
      c."category" AS "category",
      c."description" AS "description",
      c."status" AS "status",
      c."priority" AS "priority",
      c."isEscalated" AS "isEscalated",
      c."createdAt" AS "createdAt",
      c."lastActivityAt" AS "lastActivityAt",
      c."version" AS "version",
      u."label" AS "unitLabel",
      ur."name" AS "residentName",
      ur."email" AS "residentEmail",
      sp."hours" AS "slaHours",
      (EXTRACT(EPOCH FROM (now() - c."createdAt")) / 3600.0)::double precision AS "hoursOpen",
      (
        c."status" != 'RESOLVED'
        AND sp."hours" IS NOT NULL
        AND EXTRACT(EPOCH FROM (now() - c."createdAt")) / 3600.0 > sp."hours"
      ) AS "isOverdue"
    FROM "Complaint" c
    JOIN "Unit" u ON u."id" = c."unitId"
    JOIN "User" ur ON ur."id" = c."raisedById"
    LEFT JOIN "SlaPolicy" sp ON sp."category" = c."category" AND sp."priority" = c."priority"
    ${whereClause}
    ORDER BY
      "isOverdue" DESC,
      c."isEscalated" DESC,
      CASE c."priority" WHEN 'HIGH' THEN 0 WHEN 'MEDIUM' THEN 1 WHEN 'LOW' THEN 2 ELSE 3 END ASC,
      c."createdAt" ASC
  `);
}

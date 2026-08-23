import type { Category, Priority } from "@prisma/client";
import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";

export interface SlaPolicyUpdate {
  category: Category;
  priority: Priority;
  hours: number;
}

// The only write path for the SLA matrix. Since overdue is derived at read
// time from SlaPolicy — never stored on Complaint — this is the whole
// mechanism: no backfill, every open complaint is re-evaluated against the
// new hours on its very next read. See ARCHITECTURE.md, invariant 3.
export async function updateSlaMatrix(session: Session | null, updates: SlaPolicyUpdate[]): Promise<void> {
  requireAdmin(session);

  await prisma.$transaction(
    updates.map((update) =>
      prisma.slaPolicy.upsert({
        where: { category_priority: { category: update.category, priority: update.priority } },
        update: { hours: update.hours },
        create: { category: update.category, priority: update.priority, hours: update.hours },
      }),
    ),
  );
}

export interface RecurrenceSettingsUpdate {
  windowDays: number;
  thresholdCount: number;
}

export async function updateRecurrenceSettings(
  session: Session | null,
  update: RecurrenceSettingsUpdate,
): Promise<void> {
  requireAdmin(session);

  await prisma.$transaction([
    prisma.setting.upsert({
      where: { key: "recurrence_window_days" },
      update: { value: String(update.windowDays) },
      create: { key: "recurrence_window_days", value: String(update.windowDays) },
    }),
    prisma.setting.upsert({
      where: { key: "recurrence_threshold_count" },
      update: { value: String(update.thresholdCount) },
      create: { key: "recurrence_threshold_count", value: String(update.thresholdCount) },
    }),
  ]);
}

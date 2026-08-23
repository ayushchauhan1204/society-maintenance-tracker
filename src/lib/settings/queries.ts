import type { Session } from "next-auth";
import { Status, type Category, type Priority, type SlaPolicy } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { requireAdmin } from "@/lib/db/scopes";
import { hoursOpen } from "@/lib/complaints/sla";

export const DEFAULT_RECURRENCE_WINDOW_DAYS = 60;
export const DEFAULT_RECURRENCE_THRESHOLD_COUNT = 3;

export interface RecurrenceSettings {
  windowDays: number;
  thresholdCount: number;
}

// Pure read of the two recurrence Setting rows, with defaults. No session
// check — this is also called internally by lib/complaints/recurrence.ts,
// which gates admin access itself before reaching here.
export async function getRecurrenceSettings(): Promise<RecurrenceSettings> {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ["recurrence_window_days", "recurrence_threshold_count"] } },
  });
  const byKey = new Map(settings.map((setting) => [setting.key, setting.value]));

  const windowDays = Number.parseInt(byKey.get("recurrence_window_days") ?? "", 10);
  const thresholdCount = Number.parseInt(byKey.get("recurrence_threshold_count") ?? "", 10);

  return {
    windowDays: Number.isFinite(windowDays) && windowDays > 0 ? windowDays : DEFAULT_RECURRENCE_WINDOW_DAYS,
    thresholdCount:
      Number.isFinite(thresholdCount) && thresholdCount > 0 ? thresholdCount : DEFAULT_RECURRENCE_THRESHOLD_COUNT,
  };
}

// Same read, gated — the one the settings page calls directly.
export async function getRecurrenceSettingsForAdmin(session: Session | null): Promise<RecurrenceSettings> {
  requireAdmin(session);
  return getRecurrenceSettings();
}

export async function getSlaMatrix(session: Session | null): Promise<SlaPolicy[]> {
  requireAdmin(session);
  return prisma.slaPolicy.findMany({ orderBy: [{ category: "asc" }, { priority: "asc" }] });
}

export interface OpenComplaintAge {
  category: Category;
  priority: Priority;
  hoursOpen: number;
}

// Powers the "before saving" preview on the settings page: how many
// currently-open complaints would become overdue (or stop being overdue)
// under proposed new SLA values. Overdue is never stored (see
// ARCHITECTURE.md, invariant 3), so this hands the client the same
// age-vs-threshold inputs a live read would use, and lets it recompute
// against whatever hours the admin is currently typing.
export async function getOpenComplaintAges(session: Session | null): Promise<OpenComplaintAge[]> {
  requireAdmin(session);

  const complaints = await prisma.complaint.findMany({
    where: { status: { not: Status.RESOLVED } },
    select: { category: true, priority: true, createdAt: true },
  });

  const now = new Date();
  return complaints.map((complaint) => ({
    category: complaint.category,
    priority: complaint.priority,
    hoursOpen: hoursOpen(complaint, now),
  }));
}

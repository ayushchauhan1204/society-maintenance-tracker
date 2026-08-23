import { EventType, OutboxType, Status, type Category, type Complaint } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { enqueue } from "@/lib/outbox/enqueue";

const DEFAULT_RECURRENCE_WINDOW_DAYS = 60;

export interface CreateComplaintInput {
  unitId: string;
  raisedById: string;
  category: Category;
  description: string;
  photoPublicId?: string;
  photoUrl?: string;
  // Overridable for seeding historical data; defaults to the real clock.
  // Also anchors the regression-window lookup below, so backdated seed
  // complaints check regression against their own historical moment, not
  // today.
  now?: Date;
}

// Creates a complaint, its CREATED event (seq 1), and any regression link —
// all inside one transaction. See CLAUDE.md, invariant 2 and lifecycle rules.
export async function createComplaint(input: CreateComplaintInput): Promise<Complaint> {
  const now = input.now ?? new Date();

  return prisma.$transaction(async (tx) => {
    const windowSetting = await tx.setting.findUnique({
      where: { key: "recurrence_window_days" },
    });
    const windowDays = windowSetting
      ? Number.parseInt(windowSetting.value, 10)
      : DEFAULT_RECURRENCE_WINDOW_DAYS;
    const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const regressedFrom = await tx.complaint.findFirst({
      where: {
        unitId: input.unitId,
        category: input.category,
        status: Status.RESOLVED,
        resolvedAt: { gte: windowStart },
      },
      orderBy: { resolvedAt: "desc" },
    });

    const complaint = await tx.complaint.create({
      data: {
        unitId: input.unitId,
        raisedById: input.raisedById,
        category: input.category,
        description: input.description,
        photoPublicId: input.photoPublicId,
        photoUrl: input.photoUrl,
        regressedFromId: regressedFrom?.id,
        createdAt: now,
        lastActivityAt: now,
      },
      include: { unit: true },
    });

    await tx.complaintEvent.create({
      data: {
        complaintId: complaint.id,
        seq: 1,
        type: EventType.CREATED,
        actorId: input.raisedById,
        createdAt: now,
      },
    });

    const admins = await tx.user.findMany({
      where: { role: "ADMIN" },
      select: { email: true },
    });

    await enqueue(
      tx,
      admins.map((admin) => ({
        type: OutboxType.COMPLAINT_CREATED,
        recipientEmail: admin.email,
        subject: `New complaint: ${input.category} at ${complaint.unit.label}`,
        payload: {
          complaintId: complaint.id,
          category: complaint.category,
          unitLabel: complaint.unit.label,
          regressedFromId: regressedFrom?.id ?? null,
        },
      })),
    );

    return complaint;
  });
}

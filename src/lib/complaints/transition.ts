import { EventType, OutboxType, Status, type Complaint, type Prisma, type Priority } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { enqueue } from "@/lib/outbox/enqueue";

// Legal status transitions. RESOLVED is terminal — a resolved complaint is
// closed and can never reopen. See CLAUDE.md, lifecycle rules.
export const TRANSITIONS: Record<Status, Status[]> = {
  [Status.OPEN]: [Status.IN_PROGRESS, Status.RESOLVED],
  [Status.IN_PROGRESS]: [Status.RESOLVED],
  [Status.RESOLVED]: [],
};

export function legalTransitions(status: Status): Status[] {
  return TRANSITIONS[status];
}

export class ComplaintNotFoundError extends Error {
  constructor(public readonly complaintId: string) {
    super(`Complaint ${complaintId} not found`);
    this.name = "ComplaintNotFoundError";
  }
}

export class IllegalTransitionError extends Error {
  constructor(
    public readonly complaintId: string,
    public readonly fromStatus: Status,
    public readonly attempted: string,
  ) {
    super(`Illegal transition on complaint ${complaintId} from ${fromStatus}: ${attempted}`);
    this.name = "IllegalTransitionError";
  }
}

export class ConcurrencyError extends Error {
  constructor(public readonly currentState: Complaint) {
    super(
      `Version conflict on complaint ${currentState.id}: expected version does not match current version ${currentState.version}`,
    );
    this.name = "ConcurrencyError";
  }
}

type BaseInput = {
  complaintId: string;
  actorId: string;
  expectedVersion: number;
  // Overridable for seeding historical event timestamps; defaults to the
  // real clock. Production callers never pass this.
  now?: Date;
};

export type ApplyTransitionInput =
  | (BaseInput & { kind: "STATUS_CHANGE"; toStatus: Status; note?: string })
  | (BaseInput & { kind: "PRIORITY_CHANGE"; toPriority: Priority; note?: string })
  | (BaseInput & { kind: "ESCALATE"; note?: string })
  | (BaseInput & { kind: "DEESCALATE"; note?: string })
  | (BaseInput & { kind: "NOTE"; note: string });

// The one function that changes complaint state. See CLAUDE.md, invariant 1.
//
// Everything happens inside a single prisma.$transaction: the ComplaintEvent
// append, the Complaint projection update (gated on `version` for optimistic
// concurrency), and any OutboxMessage rows this change triggers. All of it,
// or none of it. See CLAUDE.md, invariant 2.
export async function applyTransition(input: ApplyTransitionInput): Promise<Complaint> {
  return prisma.$transaction(async (tx) => {
    const complaint = await tx.complaint.findUnique({
      where: { id: input.complaintId },
      include: { raisedBy: true },
    });

    if (!complaint) {
      throw new ComplaintNotFoundError(input.complaintId);
    }

    // RESOLVED is terminal: a closed complaint accepts no status, priority, or
    // escalation changes. NOTE_ADDED is the one exception — the ledger can
    // still receive commentary after the fact.
    if (complaint.status === Status.RESOLVED && input.kind !== "NOTE") {
      throw new IllegalTransitionError(complaint.id, complaint.status, input.kind);
    }

    if (input.kind === "STATUS_CHANGE" && !legalTransitions(complaint.status).includes(input.toStatus)) {
      throw new IllegalTransitionError(
        complaint.id,
        complaint.status,
        `STATUS_CHANGE -> ${input.toStatus}`,
      );
    }

    const now = input.now ?? new Date();

    let eventType: EventType;
    let fromStatus: Status | null = null;
    let toStatus: Status | null = null;
    let fromPriority: Priority | null = null;
    let toPriority: Priority | null = null;
    const projectionUpdate: Prisma.ComplaintUpdateManyMutationInput = {};

    switch (input.kind) {
      case "STATUS_CHANGE":
        eventType = EventType.STATUS_CHANGED;
        fromStatus = complaint.status;
        toStatus = input.toStatus;
        projectionUpdate.status = input.toStatus;
        if (input.toStatus === Status.RESOLVED) {
          projectionUpdate.resolvedAt = now;
        }
        break;
      case "PRIORITY_CHANGE":
        eventType = EventType.PRIORITY_CHANGED;
        fromPriority = complaint.priority;
        toPriority = input.toPriority;
        projectionUpdate.priority = input.toPriority;
        break;
      case "ESCALATE":
        eventType = EventType.ESCALATED;
        projectionUpdate.isEscalated = true;
        break;
      case "DEESCALATE":
        eventType = EventType.DEESCALATED;
        projectionUpdate.isEscalated = false;
        break;
      case "NOTE":
        eventType = EventType.NOTE_ADDED;
        break;
    }

    // Optimistic concurrency: zero rows affected means someone else changed
    // this complaint first. See CLAUDE.md, invariant 6.
    const updateResult = await tx.complaint.updateMany({
      where: { id: input.complaintId, version: input.expectedVersion },
      data: { ...projectionUpdate, lastActivityAt: now, version: { increment: 1 } },
    });

    if (updateResult.count === 0) {
      const currentState = await tx.complaint.findUniqueOrThrow({ where: { id: input.complaintId } });
      throw new ConcurrencyError(currentState);
    }

    const eventCount = await tx.complaintEvent.count({ where: { complaintId: input.complaintId } });

    await tx.complaintEvent.create({
      data: {
        complaintId: input.complaintId,
        seq: eventCount + 1,
        type: eventType,
        actorId: input.actorId,
        fromStatus,
        toStatus,
        fromPriority,
        toPriority,
        note: input.note ?? null,
        createdAt: now,
      },
    });

    // Only status changes notify today — OutboxType has no member for
    // priority/escalation/note events.
    if (input.kind === "STATUS_CHANGE") {
      await enqueue(tx, [
        {
          type: OutboxType.STATUS_CHANGE,
          recipientEmail: complaint.raisedBy.email,
          subject: `Your complaint is now ${input.toStatus}`,
          payload: {
            complaintId: complaint.id,
            category: complaint.category,
            fromStatus: complaint.status,
            toStatus: input.toStatus,
          },
        },
      ]);
    }

    return tx.complaint.findUniqueOrThrow({ where: { id: input.complaintId } });
  });
}

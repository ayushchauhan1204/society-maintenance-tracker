import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EventType, OutboxStatus, OutboxType, Priority, Status } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import {
  applyTransition,
  ConcurrencyError,
  IllegalTransitionError,
  legalTransitions,
} from "@/lib/complaints/transition";
import { isOverdue } from "@/lib/complaints/sla";

const testRunId = Date.now().toString();

let unitId: string;
let adminId: string;
const createdResidentIds: string[] = [];

async function createTestComplaint() {
  const resident = await prisma.user.create({
    data: {
      email: `resident-${testRunId}-${createdResidentIds.length}@test.local`,
      passwordHash: "test-hash",
      name: `Test Resident ${createdResidentIds.length}`,
      role: "RESIDENT",
      unitId,
    },
  });
  createdResidentIds.push(resident.id);

  const complaint = await prisma.complaint.create({
    data: {
      unitId,
      raisedById: resident.id,
      category: "OTHER",
      description: "Test complaint for the transition engine test suite.",
    },
  });

  return { complaint, residentEmail: resident.email };
}

beforeAll(async () => {
  const unit = await prisma.unit.create({
    data: { block: "ZZ", number: testRunId.slice(-6), label: `ZZ-TEST-${testRunId}` },
  });
  unitId = unit.id;

  const admin = await prisma.user.create({
    data: {
      email: `admin-${testRunId}@test.local`,
      passwordHash: "test-hash",
      name: "Test Admin",
      role: "ADMIN",
    },
  });
  adminId = admin.id;
});

afterAll(async () => {
  await prisma.outboxMessage.deleteMany({
    where: { recipientEmail: { contains: `-${testRunId}-` } },
  });
  await prisma.complaint.deleteMany({ where: { unitId } });
  await prisma.user.deleteMany({ where: { id: { in: [...createdResidentIds, adminId] } } });
  await prisma.unit.delete({ where: { id: unitId } });
});

describe("legalTransitions", () => {
  it("returns the declared map of legal next statuses", () => {
    expect(legalTransitions(Status.OPEN)).toEqual([Status.IN_PROGRESS, Status.RESOLVED]);
    expect(legalTransitions(Status.IN_PROGRESS)).toEqual([Status.RESOLVED]);
    expect(legalTransitions(Status.RESOLVED)).toEqual([]);
  });
});

describe("applyTransition - legal transitions", () => {
  it("OPEN -> IN_PROGRESS succeeds", async () => {
    const { complaint } = await createTestComplaint();
    const result = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.IN_PROGRESS,
    });
    expect(result.status).toBe(Status.IN_PROGRESS);
    expect(result.version).toBe(complaint.version + 1);
    expect(result.resolvedAt).toBeNull();
  });

  it("OPEN -> RESOLVED succeeds and sets resolvedAt", async () => {
    const { complaint } = await createTestComplaint();
    const result = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.RESOLVED,
    });
    expect(result.status).toBe(Status.RESOLVED);
    expect(result.resolvedAt).not.toBeNull();
  });

  it("IN_PROGRESS -> RESOLVED succeeds", async () => {
    const { complaint } = await createTestComplaint();
    const inProgress = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.IN_PROGRESS,
    });
    const resolved = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: inProgress.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.RESOLVED,
    });
    expect(resolved.status).toBe(Status.RESOLVED);
    expect(resolved.resolvedAt).not.toBeNull();
  });
});

describe("applyTransition - illegal transitions", () => {
  it("throws for OPEN -> OPEN", async () => {
    const { complaint } = await createTestComplaint();
    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: complaint.version,
        kind: "STATUS_CHANGE",
        toStatus: Status.OPEN,
      }),
    ).rejects.toThrow(IllegalTransitionError);
  });

  it("throws for IN_PROGRESS -> OPEN (backward)", async () => {
    const { complaint } = await createTestComplaint();
    const inProgress = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.IN_PROGRESS,
    });
    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: inProgress.version,
        kind: "STATUS_CHANGE",
        toStatus: Status.OPEN,
      }),
    ).rejects.toThrow(IllegalTransitionError);
  });

  it("throws for STATUS_CHANGE, PRIORITY_CHANGE, and escalation toggles attempted out of RESOLVED", async () => {
    const { complaint } = await createTestComplaint();
    const resolved = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.RESOLVED,
    });

    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: resolved.version,
        kind: "STATUS_CHANGE",
        toStatus: Status.IN_PROGRESS,
      }),
    ).rejects.toThrow(IllegalTransitionError);

    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: resolved.version,
        kind: "STATUS_CHANGE",
        toStatus: Status.RESOLVED,
      }),
    ).rejects.toThrow(IllegalTransitionError);

    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: resolved.version,
        kind: "PRIORITY_CHANGE",
        toPriority: Priority.HIGH,
      }),
    ).rejects.toThrow(IllegalTransitionError);

    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: resolved.version,
        kind: "ESCALATE",
      }),
    ).rejects.toThrow(IllegalTransitionError);

    await expect(
      applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: resolved.version,
        kind: "DEESCALATE",
      }),
    ).rejects.toThrow(IllegalTransitionError);
  });

  it("allows NOTE on a RESOLVED complaint, appending to the ledger and bumping lastActivityAt", async () => {
    const { complaint } = await createTestComplaint();
    const resolved = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.RESOLVED,
    });

    const beforeNoteActivity = resolved.lastActivityAt;

    const afterNote = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: resolved.version,
      kind: "NOTE",
      note: "resident confirmed the fix held up",
    });

    expect(afterNote.status).toBe(Status.RESOLVED);
    expect(afterNote.version).toBe(resolved.version + 1);
    expect(afterNote.lastActivityAt.getTime()).toBeGreaterThan(beforeNoteActivity.getTime());

    const events = await prisma.complaintEvent.findMany({
      where: { complaintId: complaint.id },
      orderBy: { seq: "asc" },
    });
    expect(events).toHaveLength(2);
    expect(events[1].type).toBe(EventType.NOTE_ADDED);
    expect(events[1].note).toBe("resident confirmed the fix held up");

    // A note on a resolved complaint is not a status change, so no outbox row.
    const outboxCount = await prisma.outboxMessage.count({
      where: { payload: { path: ["complaintId"], equals: complaint.id } },
    });
    expect(outboxCount).toBe(1); // only the STATUS_CHANGE -> RESOLVED notification
  });
});

describe("applyTransition - event ledger", () => {
  it("increments seq monotonically across mixed event types, writing the correct EventType each time", async () => {
    const { complaint } = await createTestComplaint();

    const afterStatus = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.IN_PROGRESS,
    });

    const afterPriority = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: afterStatus.version,
      kind: "PRIORITY_CHANGE",
      toPriority: Priority.HIGH,
    });

    const afterEscalate = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: afterPriority.version,
      kind: "ESCALATE",
    });

    const afterNote = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: afterEscalate.version,
      kind: "NOTE",
      note: "checked on site, parts on order",
    });

    await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: afterNote.version,
      kind: "DEESCALATE",
    });

    const events = await prisma.complaintEvent.findMany({
      where: { complaintId: complaint.id },
      orderBy: { seq: "asc" },
    });

    expect(events.map((e) => e.seq)).toEqual([1, 2, 3, 4, 5]);
    expect(events.map((e) => e.type)).toEqual([
      EventType.STATUS_CHANGED,
      EventType.PRIORITY_CHANGED,
      EventType.ESCALATED,
      EventType.NOTE_ADDED,
      EventType.DEESCALATED,
    ]);
    expect(events[1].fromPriority).toBe(Priority.MEDIUM);
    expect(events[1].toPriority).toBe(Priority.HIGH);
    expect(events[3].note).toBe("checked on site, parts on order");
  });

  it("increments version on every write", async () => {
    const { complaint } = await createTestComplaint();
    expect(complaint.version).toBe(0);

    const v1 = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "PRIORITY_CHANGE",
      toPriority: Priority.HIGH,
    });
    expect(v1.version).toBe(1);

    const v2 = await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: v1.version,
      kind: "ESCALATE",
    });
    expect(v2.version).toBe(2);
  });
});

describe("applyTransition - concurrency", () => {
  it("throws ConcurrencyError carrying the current state on a stale version, with no partial writes", async () => {
    const { complaint } = await createTestComplaint();

    await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.IN_PROGRESS,
    });

    // `complaint.version` is now stale: actual current version is 1.
    let caught: unknown;
    try {
      await applyTransition({
        complaintId: complaint.id,
        actorId: adminId,
        expectedVersion: complaint.version,
        kind: "STATUS_CHANGE",
        toStatus: Status.RESOLVED,
      });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ConcurrencyError);
    const concurrencyErr = caught as ConcurrencyError;
    expect(concurrencyErr.currentState.id).toBe(complaint.id);
    expect(concurrencyErr.currentState.version).toBe(1);
    expect(concurrencyErr.currentState.status).toBe(Status.IN_PROGRESS);

    // The failed attempt must not have leaked a partial event or projection change.
    const events = await prisma.complaintEvent.count({ where: { complaintId: complaint.id } });
    expect(events).toBe(1);

    const current = await prisma.complaint.findUniqueOrThrow({ where: { id: complaint.id } });
    expect(current.status).toBe(Status.IN_PROGRESS);
    expect(current.version).toBe(1);
  });
});

describe("applyTransition - outbox", () => {
  it("creates an outbox row in the same transaction as a status change", async () => {
    const { complaint, residentEmail } = await createTestComplaint();

    await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "STATUS_CHANGE",
      toStatus: Status.IN_PROGRESS,
    });

    const outboxRows = await prisma.outboxMessage.findMany({
      where: { recipientEmail: residentEmail },
    });

    expect(outboxRows).toHaveLength(1);
    expect(outboxRows[0].type).toBe(OutboxType.STATUS_CHANGE);
    expect(outboxRows[0].status).toBe(OutboxStatus.PENDING);
  });

  it("does not create an outbox row for non-status-change events", async () => {
    const { complaint, residentEmail } = await createTestComplaint();

    await applyTransition({
      complaintId: complaint.id,
      actorId: adminId,
      expectedVersion: complaint.version,
      kind: "PRIORITY_CHANGE",
      toPriority: Priority.HIGH,
    });

    const outboxRows = await prisma.outboxMessage.findMany({
      where: { recipientEmail: residentEmail },
    });

    expect(outboxRows).toHaveLength(0);
  });
});

describe("SLA boundary", () => {
  it("is not overdue exactly at the threshold, and is overdue one second past it", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const slaPolicy = { hours: 24 };

    const exactlyAtThreshold = {
      status: Status.OPEN,
      createdAt: new Date(now.getTime() - 24 * 60 * 60 * 1000),
    };
    expect(isOverdue(exactlyAtThreshold, slaPolicy, now)).toBe(false);

    const onePast = {
      status: Status.OPEN,
      createdAt: new Date(now.getTime() - (24 * 60 * 60 * 1000 + 1000)),
    };
    expect(isOverdue(onePast, slaPolicy, now)).toBe(true);
  });

  it("is never overdue once RESOLVED, no matter the age", () => {
    const now = new Date("2026-01-01T12:00:00.000Z");
    const veryOld = {
      status: Status.RESOLVED,
      createdAt: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    };
    expect(isOverdue(veryOld, { hours: 24 }, now)).toBe(false);
  });
});

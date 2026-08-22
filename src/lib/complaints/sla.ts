import { Status, type Complaint, type SlaPolicy } from "@prisma/client";

// `now` defaults to the real clock but can be pinned in tests to avoid
// wall-clock races at the SLA boundary.
export function hoursOpen(complaint: Pick<Complaint, "createdAt">, now: Date = new Date()): number {
  return (now.getTime() - complaint.createdAt.getTime()) / (1000 * 60 * 60);
}

// Overdue is never stored — always derived at read time. See CLAUDE.md, invariant 3.
export function isOverdue(
  complaint: Pick<Complaint, "status" | "createdAt">,
  slaPolicy: Pick<SlaPolicy, "hours">,
  now: Date = new Date(),
): boolean {
  return complaint.status !== Status.RESOLVED && hoursOpen(complaint, now) > slaPolicy.hours;
}

import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { residentComplaintScope, adminComplaintScope } from "@/lib/db/scopes";
import { isOverdue } from "@/lib/complaints/sla";
import { legalTransitions } from "@/lib/complaints/transition";
import type { Complaint } from "@prisma/client";

export type ComplaintWithOverdue = Complaint & { isOverdue: boolean };

async function attachOverdue<T extends Pick<Complaint, "status" | "createdAt" | "category" | "priority">>(
  complaints: T[],
): Promise<(T & { isOverdue: boolean })[]> {
  const policies = await prisma.slaPolicy.findMany();
  const policyMap = new Map(policies.map((policy) => [`${policy.category}:${policy.priority}`, policy]));

  return complaints.map((complaint) => {
    const policy = policyMap.get(`${complaint.category}:${complaint.priority}`);
    return { ...complaint, isOverdue: policy ? isOverdue(complaint, policy) : false };
  });
}

// Shared by the resident list page and GET /api/complaints — same scoped
// query, same overdue projection, one place to keep them consistent.
export async function listResidentComplaints(session: Session | null): Promise<ComplaintWithOverdue[]> {
  const complaints = await prisma.complaint.findMany({
    where: residentComplaintScope(session),
    orderBy: { createdAt: "desc" },
  });
  return attachOverdue(complaints);
}

export async function getResidentComplaintDetail(session: Session | null, complaintId: string) {
  const complaint = await prisma.complaint.findFirst({
    where: residentComplaintScope(session, { id: complaintId }),
    include: {
      events: {
        orderBy: { seq: "asc" },
        include: { actor: { select: { name: true } } },
      },
      regressedFrom: { select: { id: true, category: true, createdAt: true } },
    },
  });

  if (!complaint) {
    return null;
  }

  const [withOverdue] = await attachOverdue([complaint]);
  return { ...complaint, isOverdue: withOverdue.isOverdue };
}

export type ResidentComplaintDetail = NonNullable<Awaited<ReturnType<typeof getResidentComplaintDetail>>>;

// Single-complaint admin read. Overdue uses the isOverdue() helper here
// (not raw SQL) — the raw-SQL join is only for the list query. See
// ARCHITECTURE.md, invariant 3. Also carries the legal next statuses so the
// UI renders only actions that will succeed; the server still validates
// independently inside applyTransition().
export async function getAdminComplaintDetail(session: Session | null, complaintId: string) {
  const complaint = await prisma.complaint.findFirst({
    where: adminComplaintScope(session, { id: complaintId }),
    include: {
      unit: { select: { label: true } },
      raisedBy: { select: { name: true, email: true } },
      events: {
        orderBy: { seq: "asc" },
        include: { actor: { select: { name: true } } },
      },
      regressedFrom: { select: { id: true, category: true, createdAt: true } },
    },
  });

  if (!complaint) {
    return null;
  }

  const [withOverdue] = await attachOverdue([complaint]);
  return {
    ...complaint,
    isOverdue: withOverdue.isOverdue,
    legalNextStatuses: legalTransitions(complaint.status),
  };
}

export type AdminComplaintDetail = NonNullable<Awaited<ReturnType<typeof getAdminComplaintDetail>>>;

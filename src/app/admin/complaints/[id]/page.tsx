import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getAdminComplaintDetail } from "@/lib/complaints/queries";
import { CATEGORY_LABELS } from "@/lib/constants/categories";
import { ComplaintActions } from "@/components/admin/complaint-actions";
import { StatusBadge, PriorityBadge, OverdueBadge, EscalatedBadge, RegressedBadge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";

export default async function AdminComplaintDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const complaint = await getAdminComplaintDetail(session, params.id);

  if (!complaint) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        ← Back to queue
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {CATEGORY_LABELS[complaint.category]}
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">{complaint.unit.label}</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            {complaint.isOverdue && <OverdueBadge />}
            {complaint.isEscalated && <EscalatedBadge />}
            {complaint.regressedFrom && <RegressedBadge />}
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-500">
          Raised by <span className="font-medium text-slate-700">{complaint.raisedBy.name}</span> (
          {complaint.raisedBy.email})
        </p>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{complaint.description}</p>

        {complaint.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={complaint.photoUrl}
            alt="Complaint photo"
            className="mt-4 max-h-80 rounded-lg border border-slate-200 object-cover"
          />
        )}

        {complaint.regressedFrom && (
          <p className="mt-4 rounded-md bg-purple-50 px-3 py-2 text-sm text-purple-800">
            Recurs an earlier resolved complaint:{" "}
            <Link href={`/admin/complaints/${complaint.regressedFrom.id}`} className="font-medium underline">
              {CATEGORY_LABELS[complaint.regressedFrom.category]} raised{" "}
              {new Date(complaint.regressedFrom.createdAt).toLocaleDateString()}
            </Link>
          </p>
        )}
      </div>

      <ComplaintActions
        complaintId={complaint.id}
        version={complaint.version}
        currentPriority={complaint.priority}
        isEscalated={complaint.isEscalated}
        legalNextStatuses={complaint.legalNextStatuses}
        isResolved={complaint.status === "RESOLVED"}
      />

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">History</h2>
        <Timeline events={complaint.events} />
      </div>
    </div>
  );
}

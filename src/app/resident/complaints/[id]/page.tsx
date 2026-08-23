import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getResidentComplaintDetail } from "@/lib/complaints/queries";
import { CATEGORY_LABELS } from "@/lib/constants/categories";
import { StatusBadge, PriorityBadge, OverdueBadge, RegressedBadge } from "@/components/ui/badge";
import { Timeline } from "@/components/ui/timeline";

export default async function ComplaintDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const complaint = await getResidentComplaintDetail(session, params.id);

  if (!complaint) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/resident"
        className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        ← Back to complaints
      </Link>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            {CATEGORY_LABELS[complaint.category]}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusBadge status={complaint.status} />
            <PriorityBadge priority={complaint.priority} />
            {complaint.isOverdue && <OverdueBadge />}
            {complaint.regressedFrom && <RegressedBadge />}
          </div>
        </div>

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
            <Link href={`/resident/complaints/${complaint.regressedFrom.id}`} className="font-medium underline">
              {CATEGORY_LABELS[complaint.regressedFrom.category]} raised{" "}
              {new Date(complaint.regressedFrom.createdAt).toLocaleDateString()}
            </Link>
          </p>
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-700">History</h2>
        <Timeline events={complaint.events} />
      </div>
    </div>
  );
}

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listResidentComplaints } from "@/lib/complaints/queries";
import { CATEGORY_LABELS } from "@/lib/constants/categories";
import { StatusBadge, PriorityBadge, OverdueBadge, RegressedBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function ResidentComplaintsPage() {
  const session = await getServerSession(authOptions);
  const complaints = await listResidentComplaints(session);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Your complaints</h1>
          <p className="mt-1 text-sm text-slate-500">
            {complaints.length === 0
              ? "Nothing raised yet"
              : `${complaints.length} complaint${complaints.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Link
          href="/resident/new"
          className="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Raise a complaint
        </Link>
      </div>

      {complaints.length === 0 ? (
        <EmptyState
          title="No complaints yet"
          description="If something in your unit or building needs attention, raise a complaint and track it here."
          action={
            <Link
              href="/resident/new"
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
            >
              Raise a complaint
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {complaints.map((complaint) => (
            <li key={complaint.id}>
              <Link
                href={`/resident/complaints/${complaint.id}`}
                className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-indigo-300 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="font-medium text-slate-900">{CATEGORY_LABELS[complaint.category]}</span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(complaint.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{complaint.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={complaint.status} />
                  <PriorityBadge priority={complaint.priority} />
                  {complaint.isOverdue && <OverdueBadge />}
                  {complaint.regressedFromId && <RegressedBadge />}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

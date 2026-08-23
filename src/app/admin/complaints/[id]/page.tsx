import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { EventType } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { getAdminComplaintDetail, type AdminComplaintDetail } from "@/lib/complaints/queries";
import { CATEGORY_LABELS } from "@/lib/constants/categories";
import { STATUS_LABELS } from "@/lib/constants/status";
import { ComplaintActions } from "@/components/admin/complaint-actions";

const EVENT_LABELS: Record<EventType, string> = {
  CREATED: "Complaint raised",
  STATUS_CHANGED: "Status changed",
  PRIORITY_CHANGED: "Priority changed",
  ESCALATED: "Escalated",
  DEESCALATED: "De-escalated",
  NOTE_ADDED: "Note added",
};

type TimelineEvent = AdminComplaintDetail["events"][number];

function describeEvent(event: TimelineEvent): string | null {
  switch (event.type) {
    case "STATUS_CHANGED":
      return `${event.fromStatus?.replace("_", " ")} → ${event.toStatus?.replace("_", " ")}`;
    case "PRIORITY_CHANGED":
      return `${event.fromPriority} → ${event.toPriority}`;
    default:
      return null;
  }
}

export default async function AdminComplaintDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const complaint = await getAdminComplaintDetail(session, params.id);

  if (!complaint) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="text-sm text-gray-600 underline">
        ← Back to queue
      </Link>

      <div className="rounded border border-gray-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">
            {CATEGORY_LABELS[complaint.category]} — {complaint.unit.label}
          </h1>
          {complaint.isOverdue && (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">Overdue</span>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">
          Raised by {complaint.raisedBy.name} ({complaint.raisedBy.email})
        </p>
        <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{complaint.description}</p>
        {complaint.photoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={complaint.photoUrl}
            alt="Complaint photo"
            className="mt-3 max-h-80 rounded border border-gray-200 object-cover"
          />
        )}
        <div className="mt-3 flex gap-2 text-xs">
          <span className="rounded-full bg-gray-100 px-2 py-0.5">{STATUS_LABELS[complaint.status]}</span>
          <span className="rounded-full bg-gray-100 px-2 py-0.5">{complaint.priority}</span>
          {complaint.isEscalated && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-orange-700">Escalated</span>
          )}
          {complaint.regressedFrom && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">Regressed</span>
          )}
        </div>
        {complaint.regressedFrom && (
          <p className="mt-3 text-xs text-gray-600">
            Recurs an earlier resolved complaint:{" "}
            <Link href={`/admin/complaints/${complaint.regressedFrom.id}`} className="underline">
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

      <div>
        <h2 className="text-sm font-semibold text-gray-700">History</h2>
        <ol className="mt-3 flex flex-col gap-4 border-l border-gray-200 pl-4">
          {complaint.events.map((event) => {
            const detail = describeEvent(event);
            return (
              <li key={event.id} className="relative">
                <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-gray-400" />
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium">{EVENT_LABELS[event.type]}</span>
                  <span className="text-xs text-gray-500">{new Date(event.createdAt).toLocaleString()}</span>
                </div>
                <p className="text-xs text-gray-600">by {event.actor.name}</p>
                {detail && <p className="text-xs text-gray-600">{detail}</p>}
                {event.note && <p className="mt-1 text-sm italic text-gray-700">&ldquo;{event.note}&rdquo;</p>}
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

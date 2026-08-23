import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listResidentComplaints } from "@/lib/complaints/queries";
import { CATEGORY_LABELS } from "@/lib/constants/categories";

export default async function ResidentComplaintsPage() {
  const session = await getServerSession(authOptions);
  const complaints = await listResidentComplaints(session);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Your complaints</h1>
        <Link href="/resident/new" className="rounded bg-gray-900 px-4 py-2 text-sm text-white">
          Raise a complaint
        </Link>
      </div>

      {complaints.length === 0 ? (
        <p className="text-sm text-gray-600">You haven&apos;t raised any complaints yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {complaints.map((complaint) => (
            <li key={complaint.id}>
              <Link
                href={`/resident/complaints/${complaint.id}`}
                className="block rounded border border-gray-200 bg-white px-4 py-3 hover:border-gray-400"
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{CATEGORY_LABELS[complaint.category]}</span>
                  <span className="text-xs text-gray-500">
                    {new Date(complaint.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-600">{complaint.description}</p>
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">
                    {complaint.status.replace("_", " ")}
                  </span>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5">{complaint.priority}</span>
                  {complaint.isOverdue && (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-red-700">Overdue</span>
                  )}
                  {complaint.regressedFromId && (
                    <span className="rounded-full bg-purple-100 px-2 py-0.5 text-purple-700">Regressed</span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

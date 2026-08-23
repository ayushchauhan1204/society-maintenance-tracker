import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listAdminQueue } from "@/lib/complaints/adminQueue";
import { adminQueueFilterSchema } from "@/lib/schemas/complaint";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { STATUSES, STATUS_LABELS } from "@/lib/constants/status";
import { formatHours } from "@/lib/complaints/format";

function toDateInputValue(date?: Date): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export default async function AdminQueuePage({
  searchParams,
}: {
  searchParams: { category?: string; status?: string; from?: string; to?: string };
}) {
  const session = await getServerSession(authOptions);

  const parsedFilters = adminQueueFilterSchema.safeParse({
    category: searchParams.category || undefined,
    status: searchParams.status || undefined,
    from: searchParams.from || undefined,
    to: searchParams.to || undefined,
  });
  const filters = parsedFilters.success ? parsedFilters.data : {};

  const rows = await listAdminQueue(session, filters);
  const hasFilters = Boolean(filters.category || filters.status || filters.from || filters.to);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Complaint queue</h1>

      <form method="get" className="flex flex-wrap items-end gap-3 rounded border border-gray-200 bg-white p-4">
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            name="category"
            defaultValue={searchParams.category ?? ""}
            className="rounded border border-gray-300 px-2 py-1.5"
          >
            <option value="">All</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Status
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded border border-gray-300 px-2 py-1.5"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          From
          <input
            type="date"
            name="from"
            defaultValue={toDateInputValue(filters.from)}
            className="rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          To
          <input
            type="date"
            name="to"
            defaultValue={toDateInputValue(filters.to)}
            className="rounded border border-gray-300 px-2 py-1.5"
          />
        </label>
        <button type="submit" className="rounded bg-gray-900 px-4 py-1.5 text-sm text-white">
          Apply
        </button>
        {hasFilters && (
          <Link href="/admin" className="text-sm text-gray-600 underline">
            Clear
          </Link>
        )}
      </form>

      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-3 py-2">Category</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Resident</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Priority</th>
              <th className="px-3 py-2">Age</th>
              <th className="px-3 py-2">Overdue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2">
                  <Link href={`/admin/complaints/${row.id}`} className="underline">
                    {CATEGORY_LABELS[row.category]}
                  </Link>
                </td>
                <td className="px-3 py-2">{row.unitLabel}</td>
                <td className="px-3 py-2">{row.residentName}</td>
                <td className="px-3 py-2">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">{STATUS_LABELS[row.status]}</span>
                  {row.isEscalated && (
                    <span className="ml-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-700">
                      Escalated
                    </span>
                  )}
                  {row.regressedFromId && (
                    <span className="ml-1 rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-700">
                      Regressed
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{row.priority}</td>
                <td className="px-3 py-2">{formatHours(row.hoursOpen)}</td>
                <td className="px-3 py-2">
                  {row.isOverdue ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                      Overdue{row.slaHours !== null ? ` +${formatHours(row.hoursOpen - row.slaHours)}` : ""}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">—</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">
                  No complaints match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

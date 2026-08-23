import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listAdminQueue } from "@/lib/complaints/adminQueue";
import { adminQueueFilterSchema } from "@/lib/schemas/complaint";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { STATUSES, STATUS_LABELS } from "@/lib/constants/status";
import { formatHours } from "@/lib/complaints/format";
import { StatusBadge, PriorityBadge, OverdueBadge, EscalatedBadge, RegressedBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Complaint queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Sorted overdue first, then escalated, then priority, then oldest.
        </p>
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <select
            name="category"
            defaultValue={searchParams.category ?? ""}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          <span className="font-medium text-slate-700">Status</span>
          <select
            name="status"
            defaultValue={searchParams.status ?? ""}
            className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
          <span className="font-medium text-slate-700">From</span>
          <input
            type="date"
            name="from"
            defaultValue={toDateInputValue(filters.from)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-slate-700">To</span>
          <input
            type="date"
            name="to"
            defaultValue={toDateInputValue(filters.to)}
            className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </label>
        <button
          type="submit"
          className="rounded-md bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700"
        >
          Apply
        </button>
        {hasFilters && (
          <Link href="/admin" className="px-1 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-700">
            Clear filters
          </Link>
        )}
      </form>

      {rows.length === 0 ? (
        <EmptyState
          title={hasFilters ? "No complaints match these filters" : "No complaints yet"}
          description={
            hasFilters
              ? "Try widening the date range or clearing a filter."
              : "Complaints residents raise will show up here, sorted by urgency."
          }
          action={
            hasFilters ? (
              <Link href="/admin" className="text-sm font-medium text-indigo-600 hover:text-indigo-700">
                Clear filters
              </Link>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Category
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">Unit</th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Resident
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Priority
                  </th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Age
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Overdue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    className={`transition-colors hover:bg-slate-50 ${row.isOverdue ? "bg-red-50/50" : ""}`}
                  >
                    <td
                      className={`px-4 py-3 ${row.isOverdue ? "border-l-4 border-red-500" : "border-l-4 border-transparent"}`}
                    >
                      <Link
                        href={`/admin/complaints/${row.id}`}
                        className="font-medium text-slate-900 hover:text-indigo-600 hover:underline"
                      >
                        {CATEGORY_LABELS[row.category]}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{row.unitLabel}</td>
                    <td className="px-4 py-3 text-slate-700">{row.residentName}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <StatusBadge status={row.status} />
                        {row.isEscalated && <EscalatedBadge />}
                        {row.regressedFromId && <RegressedBadge />}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <PriorityBadge priority={row.priority} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                      {formatHours(row.hoursOpen)}
                    </td>
                    <td className="px-4 py-3">
                      {row.isOverdue ? (
                        <div className="flex flex-col gap-0.5">
                          <OverdueBadge />
                          {row.slaHours !== null && (
                            <span className="text-xs font-medium text-red-600">
                              +{formatHours(row.hoursOpen - row.slaHours)} past SLA
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

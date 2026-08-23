import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getDashboardStats } from "@/lib/complaints/dashboard";
import { listRecurrenceGroups } from "@/lib/complaints/recurrence";
import { getOutboxSummary } from "@/lib/outbox/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { STATUSES, STATUS_LABELS } from "@/lib/constants/status";

function StatTile({ label, value, tone }: { label: string; value: number; tone?: "red" | "orange" }) {
  const toneClass = tone === "red" ? "text-red-700" : tone === "orange" ? "text-orange-700" : "text-gray-900";
  return (
    <div className="rounded border border-gray-200 bg-white p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Bar({ label, count, max }: { label: string; count: number; max: number }) {
  const percent = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-gray-600">{label}</span>
      <div className="h-3 flex-1 rounded bg-gray-100">
        <div className="h-3 rounded bg-gray-700" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-medium">{count}</span>
    </div>
  );
}

export default async function AdminDashboardPage() {
  const session = await getServerSession(authOptions);
  const [stats, recurrenceGroups, outbox] = await Promise.all([
    getDashboardStats(session),
    listRecurrenceGroups(session),
    getOutboxSummary(session),
  ]);

  const maxStatusCount = Math.max(...STATUSES.map((s) => stats.byStatus[s]), 1);
  const maxCategoryCount = Math.max(...CATEGORIES.map((c) => stats.byCategory[c]), 1);

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-xl font-semibold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total complaints" value={stats.total} />
        <StatTile label="Overdue" value={stats.overdueCount} tone="red" />
        <StatTile label="Regressions" value={stats.regressionCount} tone="orange" />
        <StatTile label="Pending emails" value={outbox.pending} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <section className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">By status</h2>
          <div className="flex flex-col gap-2">
            {STATUSES.map((status) => (
              <Bar key={status} label={STATUS_LABELS[status]} count={stats.byStatus[status]} max={maxStatusCount} />
            ))}
          </div>
        </section>

        <section className="rounded border border-gray-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">By category</h2>
          <div className="flex flex-col gap-2">
            {CATEGORIES.map((category) => (
              <Bar
                key={category}
                label={CATEGORY_LABELS[category]}
                count={stats.byCategory[category]}
                max={maxCategoryCount}
              />
            ))}
          </div>
        </section>
      </div>

      <section className="rounded border border-gray-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-gray-700">Recurring complaints</h2>
        <p className="mb-3 mt-1 text-xs text-gray-500">
          Units with repeat complaints in the same category within the recurrence window.
        </p>
        {recurrenceGroups.length === 0 ? (
          <p className="text-sm text-gray-600">No recurring patterns detected right now.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {recurrenceGroups.map((group) => (
              <li key={`${group.unitLabel}-${group.category}`} className="text-sm">
                <Link href={`/admin?category=${group.category}`} className="font-medium underline">
                  {group.unitLabel}
                </Link>
                : {group.count} {CATEGORY_LABELS[group.category].toLowerCase()} complaints in {group.spanDays}{" "}
                days
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

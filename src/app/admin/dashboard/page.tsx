import Link from "next/link";
import { getServerSession } from "next-auth";
import type { Status } from "@prisma/client";
import { authOptions } from "@/lib/auth/options";
import { getDashboardStats } from "@/lib/complaints/dashboard";
import { listRecurrenceGroups } from "@/lib/complaints/recurrence";
import { getOutboxSummary } from "@/lib/outbox/queries";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { STATUSES, STATUS_LABELS } from "@/lib/constants/status";
import { EmptyState } from "@/components/ui/empty-state";

const TILE_TONES = {
  slate: { icon: "bg-slate-100 text-slate-600", value: "text-slate-900" },
  red: { icon: "bg-red-100 text-red-600", value: "text-red-700" },
  purple: { icon: "bg-purple-100 text-purple-600", value: "text-purple-700" },
  indigo: { icon: "bg-indigo-100 text-indigo-600", value: "text-indigo-700" },
} as const;

function StatTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: keyof typeof TILE_TONES;
  icon: React.ReactNode;
}) {
  const style = TILE_TONES[tone];
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${style.icon}`}>{icon}</div>
      <p className={`mt-3 text-2xl font-semibold tabular-nums ${style.value}`}>{value}</p>
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  );
}

const STATUS_BAR_COLOR: Record<Status, string> = {
  OPEN: "bg-sky-500",
  IN_PROGRESS: "bg-amber-500",
  RESOLVED: "bg-emerald-500",
};

function Bar({ label, count, max, colorClass = "bg-indigo-500" }: { label: string; count: number; max: number; colorClass?: string }) {
  const percent = max > 0 ? Math.round((count / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-36 shrink-0 truncate text-slate-600">{label}</span>
      <div className="h-2.5 flex-1 rounded-full bg-slate-100">
        <div className={`h-2.5 rounded-full ${colorClass}`} style={{ width: `${percent}%` }} />
      </div>
      <span className="w-6 shrink-0 text-right font-medium tabular-nums text-slate-900">{count}</span>
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">A snapshot of the whole complaint pipeline, right now.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Total complaints"
          value={stats.total}
          tone="slate"
          icon={
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5.5A2.5 2.5 0 0 1 6.5 3h7A2.5 2.5 0 0 1 16 5.5v9a2.5 2.5 0 0 1-2.5 2.5h-7A2.5 2.5 0 0 1 4 14.5v-9Z" />
              <path strokeLinecap="round" d="M7 8h6M7 11h4" />
            </svg>
          }
        />
        <StatTile
          label="Overdue"
          value={stats.overdueCount}
          tone="red"
          icon={
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" d="M10 6.5v4" />
              <circle cx="10" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 2.5 2.5 16h15L10 2.5Z" />
            </svg>
          }
        />
        <StatTile
          label="Regressions"
          value={stats.regressionCount}
          tone="purple"
          icon={
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a5 5 0 0 1 8.5-3.5M13.5 1.5l.5 4-4-.6M15 15a5 5 0 0 1-8.5 3.5M4.5 18.5 4 14.5l4 .6" />
            </svg>
          }
        />
        <StatTile
          label="Pending emails"
          value={outbox.pending}
          tone="indigo"
          icon={
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.6}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 5.5A1.5 1.5 0 0 1 4.5 4h11A1.5 1.5 0 0 1 17 5.5v9a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 14.5v-9Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="m3.5 5 6.5 5 6.5-5" />
            </svg>
          }
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">By status</h2>
          <div className="flex flex-col gap-3">
            {STATUSES.map((status) => (
              <Bar
                key={status}
                label={STATUS_LABELS[status]}
                count={stats.byStatus[status]}
                max={maxStatusCount}
                colorClass={STATUS_BAR_COLOR[status]}
              />
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-700">By category</h2>
          <div className="flex flex-col gap-3">
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

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-700">Recurring complaints</h2>
        <p className="mb-4 mt-1 text-xs text-slate-500">
          Units with repeat complaints in the same category within the recurrence window.
        </p>
        {recurrenceGroups.length === 0 ? (
          <EmptyState
            title="No recurring patterns detected"
            description="Once a unit raises the same kind of complaint repeatedly within the recurrence window, it'll show up here."
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {recurrenceGroups.map((group) => (
              <li
                key={`${group.unitLabel}-${group.category}`}
                className="flex items-center justify-between rounded-md bg-purple-50 px-3 py-2 text-sm"
              >
                <span>
                  <Link href={`/admin?category=${group.category}`} className="font-medium text-purple-800 hover:underline">
                    {group.unitLabel}
                  </Link>
                  <span className="text-purple-900">
                    {" "}
                    — {group.count} {CATEGORY_LABELS[group.category].toLowerCase()} complaints in {group.spanDays}{" "}
                    days
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

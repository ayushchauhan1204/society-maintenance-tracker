import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getOutboxSummary } from "@/lib/outbox/queries";
import { DrainOutboxButton } from "@/components/admin/drain-outbox-button";

export default async function AdminSystemPage() {
  const session = await getServerSession(authOptions);
  const summary = await getOutboxSummary(session);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">System</h1>
        <p className="mt-1 text-sm text-slate-500">Operational tools that don&apos;t belong on a complaint.</p>
      </div>

      <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-700">Email outbox</h2>
          <p className="mt-1 text-sm text-slate-500">
            Status changes and important notices already nudge this to drain automatically in the background.
            This button is a manual catch-up — useful for demoing, or clearing a backlog without waiting.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
            Pending: {summary.pending}
          </span>
          <span className="rounded-full bg-emerald-100 px-3 py-1 font-medium text-emerald-700">
            Sent: {summary.sent}
          </span>
          <span className="rounded-full bg-red-100 px-3 py-1 font-medium text-red-700">
            Failed: {summary.failed}
          </span>
        </div>
        <DrainOutboxButton />
      </div>
    </div>
  );
}

import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getOutboxSummary } from "@/lib/outbox/queries";
import { DrainOutboxButton } from "@/components/admin/drain-outbox-button";

export default async function AdminSystemPage() {
  const session = await getServerSession(authOptions);
  const summary = await getOutboxSummary(session);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">System</h1>

      <div className="flex flex-col gap-4 rounded border border-gray-200 bg-white p-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-700">Email outbox</h2>
          <p className="mt-1 text-sm text-gray-600">
            Status-change, new-complaint, and important-notice emails are queued here and sent by the drain
            worker — never inline from a request.
          </p>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="rounded-full bg-gray-100 px-3 py-1">Pending: {summary.pending}</span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-green-700">Sent: {summary.sent}</span>
          <span className="rounded-full bg-red-100 px-3 py-1 text-red-700">Failed: {summary.failed}</span>
        </div>
        <DrainOutboxButton />
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Priority, Status } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/constants/status";
import { Spinner } from "@/components/ui/spinner";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

export function ComplaintActions({
  complaintId,
  version,
  currentPriority,
  isEscalated,
  legalNextStatuses,
  isResolved,
}: {
  complaintId: string;
  version: number;
  currentPriority: Priority;
  isEscalated: boolean;
  legalNextStatuses: Status[];
  isResolved: boolean;
}) {
  const router = useRouter();
  const [priority, setPriority] = useState<Priority>(currentPriority);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function sendAction(body: Record<string, unknown>): Promise<boolean> {
    setError(null);
    setIsSubmitting(true);

    const res = await fetch(`/api/admin/complaints/${complaintId}/actions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, expectedVersion: version }),
    });

    setIsSubmitting(false);

    if (res.status === 409) {
      setError("Someone else updated this complaint. Refresh and try again.");
      return false;
    }
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Action failed");
      return false;
    }

    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-700">Actions</h2>

      {error && (
        <p className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {legalNextStatuses.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change status</span>
          <div className="flex flex-wrap gap-2">
            {legalNextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isSubmitting}
                onClick={() => sendAction({ kind: "STATUS_CHANGE", toStatus: s })}
                className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting && <Spinner className="h-3.5 w-3.5" />}
                Mark {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isResolved && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Change priority</span>
          <div className="flex items-center gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              disabled={isSubmitting}
              className="rounded-md border border-slate-300 px-2.5 py-1.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
            >
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={isSubmitting || priority === currentPriority}
              onClick={() => sendAction({ kind: "PRIORITY_CHANGE", toPriority: priority })}
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {!isResolved && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Escalation</span>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => sendAction(isEscalated ? { kind: "DEESCALATE" } : { kind: "ESCALATE" })}
            className={`self-start rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
              isEscalated
                ? "border-slate-300 text-slate-700 hover:bg-slate-50"
                : "border-orange-300 text-orange-700 hover:bg-orange-50"
            }`}
          >
            {isEscalated ? "De-escalate" : "Escalate"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add a note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          disabled={isSubmitting}
          placeholder="Internal note, added to the ledger..."
          className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50"
        />
        <button
          type="button"
          disabled={isSubmitting || note.trim().length === 0}
          onClick={async () => {
            const ok = await sendAction({ kind: "NOTE", note: note.trim() });
            if (ok) setNote("");
          }}
          className="inline-flex items-center gap-2 self-start rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <Spinner className="h-3.5 w-3.5" />}
          Add note
        </button>
      </div>
    </div>
  );
}

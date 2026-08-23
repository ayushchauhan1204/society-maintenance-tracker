"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Priority, Status } from "@prisma/client";
import { STATUS_LABELS } from "@/lib/constants/status";

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
    <div className="flex flex-col gap-4 rounded border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-700">Actions</h2>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {legalNextStatuses.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-500">Change status</span>
          <div className="flex gap-2">
            {legalNextStatuses.map((s) => (
              <button
                key={s}
                type="button"
                disabled={isSubmitting}
                onClick={() => sendAction({ kind: "STATUS_CHANGE", toStatus: s })}
                className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
              >
                Mark {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isResolved && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-500">Change priority</span>
          <div className="flex items-center gap-2">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as Priority)}
              className="rounded border border-gray-300 px-2 py-1.5 text-sm"
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
              className="rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              Update
            </button>
          </div>
        </div>
      )}

      {!isResolved && (
        <div className="flex flex-col gap-2">
          <span className="text-xs font-medium text-gray-500">Escalation</span>
          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => sendAction(isEscalated ? { kind: "DEESCALATE" } : { kind: "ESCALATE" })}
            className="self-start rounded border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {isEscalated ? "De-escalate" : "Escalate"}
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-gray-500">Add a note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="Internal note, added to the ledger..."
          className="rounded border border-gray-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          disabled={isSubmitting || note.trim().length === 0}
          onClick={async () => {
            const ok = await sendAction({ kind: "NOTE", note: note.trim() });
            if (ok) setNote("");
          }}
          className="self-start rounded bg-gray-900 px-3 py-1.5 text-sm text-white disabled:opacity-50"
        >
          Add note
        </button>
      </div>
    </div>
  );
}

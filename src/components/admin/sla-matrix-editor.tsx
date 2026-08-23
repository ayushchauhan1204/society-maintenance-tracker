"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Category, Priority } from "@prisma/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { Spinner } from "@/components/ui/spinner";

const PRIORITIES: Priority[] = ["LOW", "MEDIUM", "HIGH"];

interface SlaPolicyRow {
  category: Category;
  priority: Priority;
  hours: number;
}

interface OpenComplaintAge {
  category: Category;
  priority: Priority;
  hoursOpen: number;
}

function cellKey(category: Category, priority: Priority): string {
  return `${category}:${priority}`;
}

function hoursToDaysDisplay(hours: number): string {
  return (hours / 24).toFixed(2);
}

export function SlaMatrixEditor({
  initialMatrix,
  openComplaintAges,
}: {
  initialMatrix: SlaPolicyRow[];
  openComplaintAges: OpenComplaintAge[];
}) {
  const router = useRouter();

  const originalHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of initialMatrix) map.set(cellKey(row.category, row.priority), row.hours);
    return map;
  }, [initialMatrix]);

  // Kept as raw day-strings, not numbers, so typing "0." or "2." doesn't get
  // fought by a controlled input reformatting mid-keystroke.
  const [dayInputs, setDayInputs] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const row of initialMatrix) {
      initial[cellKey(row.category, row.priority)] = hoursToDaysDisplay(row.hours);
    }
    return initial;
  });
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  function setCell(category: Category, priority: Priority, value: string) {
    setSavedMessage(null);
    setDayInputs((prev) => ({ ...prev, [cellKey(category, priority)]: value }));
  }

  // Every cell's edited value, in hours — the stored unit. Invalid or blank
  // input falls back to the original stored value, and non-positive results
  // floor at 1 hour, so the preview and the save payload can never carry a
  // non-positive threshold.
  const editedHours = useMemo(() => {
    const map = new Map<string, number>();
    for (const [key, raw] of Object.entries(dayInputs)) {
      const days = Number.parseFloat(raw);
      const original = originalHours.get(key) ?? 1;
      const hours = Number.isFinite(days) && days > 0 ? Math.max(1, Math.round(days * 24)) : original;
      map.set(key, hours);
    }
    return map;
  }, [dayInputs, originalHours]);

  const isDirty = useMemo(() => {
    let dirty = false;
    editedHours.forEach((hours, key) => {
      if (hours !== originalHours.get(key)) dirty = true;
    });
    return dirty;
  }, [editedHours, originalHours]);

  // Before saving: how many currently-open complaints would become overdue,
  // or stop being overdue, under the edited values. Recomputed on every
  // keystroke against the same age-vs-threshold data a live read would use —
  // overdue is never stored, so this is just that computation done early.
  const preview = useMemo(() => {
    let current = 0;
    let projected = 0;
    let becoming = 0;
    let noLonger = 0;

    for (const complaint of openComplaintAges) {
      const key = cellKey(complaint.category, complaint.priority);
      const originalThreshold = originalHours.get(key) ?? Infinity;
      const editedThreshold = editedHours.get(key) ?? originalThreshold;
      const wasOverdue = complaint.hoursOpen > originalThreshold;
      const willBeOverdue = complaint.hoursOpen > editedThreshold;

      if (wasOverdue) current += 1;
      if (willBeOverdue) projected += 1;
      if (!wasOverdue && willBeOverdue) becoming += 1;
      if (wasOverdue && !willBeOverdue) noLonger += 1;
    }

    return { current, projected, becoming, noLonger };
  }, [openComplaintAges, originalHours, editedHours]);

  async function handleSave() {
    setError(null);
    setIsSaving(true);

    const policies = CATEGORIES.flatMap((category) =>
      PRIORITIES.map((priority) => ({
        category,
        priority,
        hours: editedHours.get(cellKey(category, priority)) ?? 1,
      })),
    );

    const res = await fetch("/api/admin/settings/sla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ policies }),
    });

    setIsSaving(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not save the SLA matrix");
      return;
    }

    setSavedMessage("SLA matrix saved.");
    router.refresh();
  }

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">SLA matrix</h2>
        <p className="mt-1 text-sm text-slate-500">
          How long a complaint can stay open, by category and priority, before it counts as overdue. Values are
          in days; hours are shown alongside anything under a day.
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr>
                <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Category
                </th>
                {PRIORITIES.map((priority) => (
                  <th
                    key={priority}
                    className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {priority}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CATEGORIES.map((category) => (
                <tr key={category}>
                  <td className="px-4 py-3 font-medium text-slate-900">{CATEGORY_LABELS[category]}</td>
                  {PRIORITIES.map((priority) => {
                    const key = cellKey(category, priority);
                    const hours = editedHours.get(key) ?? 0;
                    return (
                      <td key={priority} className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={dayInputs[key] ?? ""}
                            onChange={(e) => setCell(category, priority, e.target.value)}
                            className="w-20 rounded-md border border-slate-300 px-2 py-1 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          />
                          <span className="text-xs text-slate-400">days</span>
                        </div>
                        {hours < 24 && <span className="mt-0.5 block text-xs text-slate-400">≈ {hours}h</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isDirty && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <p>
            Overdue right now: <strong>{preview.current}</strong>. With these changes:{" "}
            <strong>{preview.projected}</strong>.
          </p>
          <p className="mt-1 text-xs">
            {preview.becoming > 0 &&
              `${preview.becoming} complaint${preview.becoming === 1 ? "" : "s"} would newly become overdue. `}
            {preview.noLonger > 0 &&
              `${preview.noLonger} complaint${preview.noLonger === 1 ? "" : "s"} would no longer be overdue.`}
            {preview.becoming === 0 && preview.noLonger === 0 && "No open complaint crosses a threshold."}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {savedMessage && !isDirty && <p className="text-sm text-emerald-700">{savedMessage}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || !isDirty}
        className="inline-flex items-center gap-2 self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving && <Spinner className="h-4 w-4" />}
        {isSaving ? "Saving..." : "Save SLA matrix"}
      </button>
    </section>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export function RecurrenceSettingsForm({
  initialWindowDays,
  initialThresholdCount,
}: {
  initialWindowDays: number;
  initialThresholdCount: number;
}) {
  const router = useRouter();
  const [windowDays, setWindowDays] = useState(String(initialWindowDays));
  const [thresholdCount, setThresholdCount] = useState(String(initialThresholdCount));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    const res = await fetch("/api/admin/settings/recurrence", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recurrenceWindowDays: Number(windowDays),
        recurrenceThresholdCount: Number(thresholdCount),
      }),
    });

    setIsSaving(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Could not save settings");
      return;
    }

    setSavedMessage("Settings saved.");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h2 className="text-sm font-semibold text-slate-700">Recurrence detection</h2>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">Recurrence window (days)</span>
        <input
          type="number"
          min="1"
          step="1"
          required
          value={windowDays}
          onChange={(e) => {
            setWindowDays(e.target.value);
            setSavedMessage(null);
          }}
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-500">
          How far back to look, from today, when grouping repeat complaints for the same unit and category.
        </span>
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium text-slate-700">Recurrence threshold (complaint count)</span>
        <input
          type="number"
          min="1"
          step="1"
          required
          value={thresholdCount}
          onChange={(e) => {
            setThresholdCount(e.target.value);
            setSavedMessage(null);
          }}
          className="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <span className="text-xs text-slate-500">
          How many complaints in that window count as a recurring problem — this is what the dashboard&apos;s
          recurrence panel groups on.
        </span>
      </label>

      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {savedMessage && <p className="text-sm text-emerald-700">{savedMessage}</p>}

      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex items-center gap-2 self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSaving && <Spinner className="h-4 w-4" />}
        {isSaving ? "Saving..." : "Save settings"}
      </button>
    </form>
  );
}

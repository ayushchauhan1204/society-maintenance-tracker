"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/ui/spinner";

export function DrainOutboxButton() {
  const router = useRouter();
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; retried: number; failed: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsSending(true);
    setError(null);
    setResult(null);

    const res = await fetch("/api/admin/outbox/drain", { method: "POST" });
    setIsSending(false);

    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      setError(payload.error ?? "Failed to send pending emails");
      return;
    }

    setResult(await res.json());
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isSending}
        className="inline-flex items-center gap-2 self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isSending && <Spinner className="h-4 w-4" />}
        {isSending ? "Sending..." : "Send pending emails"}
      </button>
      {result && (
        <p className="text-sm text-slate-500">
          Sent <span className="font-medium text-slate-700">{result.sent}</span>, retried{" "}
          <span className="font-medium text-slate-700">{result.retried}</span>, failed{" "}
          <span className="font-medium text-slate-700">{result.failed}</span>.
        </p>
      )}
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}

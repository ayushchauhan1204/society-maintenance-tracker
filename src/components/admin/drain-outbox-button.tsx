"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
        className="self-start rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isSending ? "Sending..." : "Send pending emails"}
      </button>
      {result && (
        <p className="text-sm text-gray-600">
          Sent {result.sent}, retried {result.retried}, failed {result.failed}.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

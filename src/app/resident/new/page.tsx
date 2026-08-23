"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category } from "@prisma/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";

export default function NewComplaintPage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, description }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "Could not raise complaint");
      setIsSubmitting(false);
      return;
    }

    const complaint = await res.json();
    router.push(`/resident/complaints/${complaint.id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Raise a complaint</h1>
      <form onSubmit={handleSubmit} className="flex max-w-lg flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Category
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded border border-gray-300 px-3 py-2"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Description
          <textarea
            required
            minLength={10}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={isSubmitting}
          className="self-start rounded bg-gray-900 px-4 py-2 text-white disabled:opacity-50"
        >
          {isSubmitting ? "Submitting..." : "Submit complaint"}
        </button>
      </form>
    </div>
  );
}

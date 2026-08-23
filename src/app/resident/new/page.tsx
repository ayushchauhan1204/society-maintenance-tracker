"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category } from "@prisma/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from "@/lib/constants/uploads";
import { Spinner } from "@/components/ui/spinner";

interface SignedUpload {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  signature: string;
  folder: string;
  allowedFormats: string;
}

async function uploadPhoto(file: File): Promise<{ photoPublicId: string; photoUrl: string }> {
  const signRes = await fetch("/api/uploads/sign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mimeType: file.type, sizeBytes: file.size }),
  });
  if (!signRes.ok) {
    const body = await signRes.json().catch(() => ({}));
    throw new Error(body.error ?? "Could not prepare photo upload");
  }
  const signed: SignedUpload = await signRes.json();

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", signed.apiKey);
  formData.append("timestamp", String(signed.timestamp));
  formData.append("signature", signed.signature);
  formData.append("folder", signed.folder);
  formData.append("allowed_formats", signed.allowedFormats);

  // Direct to Cloudinary — the server never sees these bytes.
  const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${signed.cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });
  if (!uploadRes.ok) {
    throw new Error("Photo upload failed, please try again");
  }
  const uploaded = await uploadRes.json();
  return { photoPublicId: uploaded.public_id, photoUrl: uploaded.secure_url };
}

export default function NewComplaintPage() {
  const router = useRouter();
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [description, setDescription] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreviewUrl, setPhotoPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);

    if (!file) {
      setPhotoFile(null);
      setPhotoPreviewUrl(null);
      return;
    }

    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.type as (typeof ALLOWED_PHOTO_MIME_TYPES)[number])) {
      setError("Photo must be a JPEG, PNG, WEBP, or GIF image.");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      setError(`Photo must be ${MAX_PHOTO_BYTES / (1024 * 1024)}MB or smaller.`);
      e.target.value = "";
      return;
    }

    setPhotoFile(file);
    setPhotoPreviewUrl(URL.createObjectURL(file));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    let photo: { photoPublicId: string; photoUrl: string } | undefined;
    if (photoFile) {
      setUploadStatus("Uploading photo...");
      try {
        photo = await uploadPhoto(photoFile);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Photo upload failed");
        setIsSubmitting(false);
        setUploadStatus(null);
        return;
      }
      setUploadStatus(null);
    }

    const res = await fetch("/api/complaints", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category, description, ...photo }),
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
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Raise a complaint</h1>
        <p className="mt-1 text-sm text-slate-500">
          Give as much detail as you can — the admin team triages by category and priority.
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="flex max-w-lg flex-col gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      >
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Description</span>
          <textarea
            required
            minLength={10}
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the issue in detail..."
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-xs text-slate-400">At least 10 characters.</span>
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium text-slate-700">Photo (optional)</span>
          <input
            type="file"
            accept={ALLOWED_PHOTO_MIME_TYPES.join(",")}
            onChange={handlePhotoChange}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-3 file:py-1 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
          <span className="text-xs text-slate-400">
            JPEG, PNG, WEBP, or GIF, up to {MAX_PHOTO_BYTES / (1024 * 1024)}MB.
          </span>
        </label>

        {photoPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoPreviewUrl}
            alt="Selected photo preview"
            className="max-h-48 rounded-lg border border-slate-200 object-cover"
          />
        )}

        {uploadStatus && (
          <p className="flex items-center gap-2 text-sm text-slate-600">
            <Spinner className="h-4 w-4" />
            {uploadStatus}
          </p>
        )}
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="inline-flex items-center justify-center gap-2 self-start rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting && <Spinner className="h-4 w-4" />}
          {isSubmitting ? "Submitting..." : "Submit complaint"}
        </button>
      </form>
    </div>
  );
}

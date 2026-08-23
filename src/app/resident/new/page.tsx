"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Category } from "@prisma/client";
import { CATEGORIES, CATEGORY_LABELS } from "@/lib/constants/categories";
import { ALLOWED_PHOTO_MIME_TYPES, MAX_PHOTO_BYTES } from "@/lib/constants/uploads";

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
        <label className="flex flex-col gap-1 text-sm">
          Photo (optional)
          <input
            type="file"
            accept={ALLOWED_PHOTO_MIME_TYPES.join(",")}
            onChange={handlePhotoChange}
            className="rounded border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        {photoPreviewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoPreviewUrl} alt="Selected photo preview" className="max-h-48 rounded border border-gray-200 object-cover" />
        )}
        {uploadStatus && <p className="text-sm text-gray-600">{uploadStatus}</p>}
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

import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { requireResident } from "@/lib/db/scopes";
import { errorResponse } from "@/lib/api/errors";
import { signUploadSchema } from "@/lib/schemas/upload";
import { createSignedUpload } from "@/lib/uploads/cloudinary";

// mimeType/sizeBytes are validated here, before signing — see invariant 7.
// This only bounds what the client *declares*; allowed_formats is the one
// constraint Cloudinary itself enforces server-side on the actual bytes.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = signUploadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    requireResident(session);
    return NextResponse.json(createSignedUpload());
  } catch (err) {
    return errorResponse(err);
  }
}

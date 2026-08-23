import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { residentComplaintCreateScope } from "@/lib/db/scopes";
import { errorResponse } from "@/lib/api/errors";
import { createComplaintSchema } from "@/lib/schemas/complaint";
import { createComplaint } from "@/lib/complaints/create";
import { listResidentComplaints } from "@/lib/complaints/queries";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const complaints = await listResidentComplaints(session);
    return NextResponse.json(complaints);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createComplaintSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const scope = residentComplaintCreateScope(session);
    const complaint = await createComplaint({
      unitId: scope.unitId,
      raisedById: scope.raisedById,
      category: parsed.data.category,
      description: parsed.data.description,
      photoPublicId: parsed.data.photoPublicId,
      photoUrl: parsed.data.photoUrl,
    });
    return NextResponse.json(complaint, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

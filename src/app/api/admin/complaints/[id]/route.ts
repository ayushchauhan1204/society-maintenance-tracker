import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { errorResponse } from "@/lib/api/errors";
import { getAdminComplaintDetail } from "@/lib/complaints/queries";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const session = await getServerSession(authOptions);
    const complaint = await getAdminComplaintDetail(session, params.id);
    if (!complaint) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(complaint);
  } catch (err) {
    return errorResponse(err);
  }
}

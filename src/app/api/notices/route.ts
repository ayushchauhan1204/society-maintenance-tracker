import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { errorResponse } from "@/lib/api/errors";
import { listNotices } from "@/lib/notices/queries";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const notices = await listNotices(session);
    return NextResponse.json(notices);
  } catch (err) {
    return errorResponse(err);
  }
}

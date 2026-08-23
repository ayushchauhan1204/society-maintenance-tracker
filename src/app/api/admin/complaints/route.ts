import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { errorResponse } from "@/lib/api/errors";
import { adminQueueFilterSchema } from "@/lib/schemas/complaint";
import { listAdminQueue } from "@/lib/complaints/adminQueue";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const parsed = adminQueueFilterSchema.safeParse({
    category: url.searchParams.get("category") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid filters", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const rows = await listAdminQueue(session, parsed.data);
    return NextResponse.json(rows);
  } catch (err) {
    return errorResponse(err);
  }
}

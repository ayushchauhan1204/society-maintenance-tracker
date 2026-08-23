import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { requireAdmin } from "@/lib/db/scopes";
import { errorResponse } from "@/lib/api/errors";
import { createNoticeSchema } from "@/lib/schemas/notice";
import { createNotice } from "@/lib/notices/create";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = createNoticeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    const admin = requireAdmin(session);
    const notice = await createNotice({ ...parsed.data, postedById: admin.user.id });
    return NextResponse.json(notice, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}

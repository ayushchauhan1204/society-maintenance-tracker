import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { errorResponse } from "@/lib/api/errors";
import { slaMatrixUpdateSchema } from "@/lib/schemas/settings";
import { updateSlaMatrix } from "@/lib/settings/update";
import { getSlaMatrix } from "@/lib/settings/queries";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = slaMatrixUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    await updateSlaMatrix(session, parsed.data.policies);
    const matrix = await getSlaMatrix(session);
    return NextResponse.json(matrix);
  } catch (err) {
    return errorResponse(err);
  }
}

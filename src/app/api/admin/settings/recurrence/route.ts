import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { errorResponse } from "@/lib/api/errors";
import { recurrenceSettingsUpdateSchema } from "@/lib/schemas/settings";
import { updateRecurrenceSettings } from "@/lib/settings/update";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = recurrenceSettingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const session = await getServerSession(authOptions);
    await updateRecurrenceSettings(session, {
      windowDays: parsed.data.recurrenceWindowDays,
      thresholdCount: parsed.data.recurrenceThresholdCount,
    });
    return NextResponse.json(parsed.data);
  } catch (err) {
    return errorResponse(err);
  }
}

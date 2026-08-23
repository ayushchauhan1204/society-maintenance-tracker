import { NextResponse } from "next/server";
import { registerSchema } from "@/lib/schemas/auth";
import { registerResident, EmailInUseError, UnitNotFoundError } from "@/lib/auth/register";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", issues: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const user = await registerResident(parsed.data);
    return NextResponse.json({ id: user.id, email: user.email }, { status: 201 });
  } catch (err) {
    if (err instanceof EmailInUseError) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }
    if (err instanceof UnitNotFoundError) {
      return NextResponse.json({ error: "Selected unit does not exist" }, { status: 400 });
    }
    throw err;
  }
}

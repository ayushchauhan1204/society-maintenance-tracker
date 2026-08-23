import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/client";

// Public: the registration page needs this before a session exists. Only
// exposes id + label — nothing about a unit's residents or complaints.
export async function GET() {
  const units = await prisma.unit.findMany({
    orderBy: [{ block: "asc" }, { number: "asc" }],
    select: { id: true, label: true },
  });
  return NextResponse.json(units);
}

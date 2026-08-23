import type { Session } from "next-auth";
import { prisma } from "@/lib/db/client";
import { requireAuthenticated } from "@/lib/db/scopes";

// The notice board has no per-user ownership to scope against — every
// resident and admin sees the same list. Important notices pin to the top.
export async function listNotices(session: Session | null) {
  requireAuthenticated(session);
  return prisma.notice.findMany({
    orderBy: [{ isImportant: "desc" }, { createdAt: "desc" }],
    include: { postedBy: { select: { name: true } } },
  });
}

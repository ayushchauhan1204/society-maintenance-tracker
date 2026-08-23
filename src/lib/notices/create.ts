import { OutboxType, Role, type Notice } from "@prisma/client";
import { prisma } from "@/lib/db/client";
import { enqueue } from "@/lib/outbox/enqueue";

export interface CreateNoticeInput {
  title: string;
  body: string;
  isImportant: boolean;
  postedById: string;
}

// Creates the notice and, if important, enqueues one IMPORTANT_NOTICE row
// per resident — both inside one transaction, so a crash between them can
// never leave an important notice with no emails queued. The drain worker
// sends them later; this only ever inserts. See ARCHITECTURE.md, invariant 4.
export async function createNotice(input: CreateNoticeInput): Promise<Notice> {
  return prisma.$transaction(async (tx) => {
    const notice = await tx.notice.create({
      data: {
        title: input.title,
        body: input.body,
        isImportant: input.isImportant,
        postedById: input.postedById,
      },
    });

    if (input.isImportant) {
      const residents = await tx.user.findMany({
        where: { role: Role.RESIDENT },
        select: { email: true },
      });

      await enqueue(
        tx,
        residents.map((resident) => ({
          type: OutboxType.IMPORTANT_NOTICE,
          recipientEmail: resident.email,
          subject: `Important notice: ${notice.title}`,
          payload: { noticeId: notice.id, title: notice.title, body: notice.body },
        })),
      );
    }

    return notice;
  });
}

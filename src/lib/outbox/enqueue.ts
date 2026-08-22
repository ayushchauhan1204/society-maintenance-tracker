import type { Prisma, OutboxType } from "@prisma/client";

export interface OutboxMessageInput {
  type: OutboxType;
  recipientEmail: string;
  subject: string;
  payload: Prisma.InputJsonValue;
}

// Takes a transaction client so it can be called from inside an existing
// prisma.$transaction. Only ever inserts — never sends. See CLAUDE.md, invariant 4.
export async function enqueue(
  tx: Prisma.TransactionClient,
  messages: OutboxMessageInput[],
): Promise<void> {
  if (messages.length === 0) {
    return;
  }

  await tx.outboxMessage.createMany({
    data: messages.map((message) => ({
      type: message.type,
      recipientEmail: message.recipientEmail,
      subject: message.subject,
      payload: message.payload,
    })),
  });
}

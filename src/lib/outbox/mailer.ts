import nodemailer from "nodemailer";
import type { OutboxMessage } from "@prisma/client";

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT ?? 587);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });
  }
  return transporter;
}

function field(payload: unknown, key: string): string {
  if (payload && typeof payload === "object" && key in payload) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
  }
  return "";
}

// Renders a meaningful body per outbox type: status-change emails name the
// complaint (by category) and the transition; notice emails carry the full
// title and body.
function renderBody(message: OutboxMessage): string {
  const payload = message.payload;

  switch (message.type) {
    case "STATUS_CHANGE": {
      const category = field(payload, "category");
      const fromStatus = field(payload, "fromStatus");
      const toStatus = field(payload, "toStatus");
      return (
        `Your ${category} complaint has moved from ${fromStatus} to ${toStatus}.\n\n` +
        `Complaint ID: ${field(payload, "complaintId")}`
      );
    }
    case "COMPLAINT_CREATED": {
      const category = field(payload, "category");
      const unitLabel = field(payload, "unitLabel");
      const regressedFromId = field(payload, "regressedFromId");
      return (
        `A new ${category} complaint was raised at ${unitLabel}.\n\n` +
        (regressedFromId ? "This recurs an earlier resolved complaint.\n\n" : "") +
        `Complaint ID: ${field(payload, "complaintId")}`
      );
    }
    case "IMPORTANT_NOTICE": {
      const title = field(payload, "title");
      const body = field(payload, "body");
      return `${title}\n\n${body}\n\n— Society management`;
    }
    default:
      return message.subject;
  }
}

// Only ever called from the drain worker, never from a request handler. See
// ARCHITECTURE.md, invariant 4.
export async function sendMail(message: OutboxMessage): Promise<void> {
  await getTransporter().sendMail({
    from: process.env.EMAIL_FROM,
    to: message.recipientEmail,
    subject: message.subject,
    text: renderBody(message),
  });
}

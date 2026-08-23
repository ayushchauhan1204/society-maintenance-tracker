import type { EventType, Priority, Status } from "@prisma/client";

export interface TimelineEvent {
  id: string;
  type: EventType;
  createdAt: string | Date;
  actor: { name: string };
  fromStatus: Status | null;
  toStatus: Status | null;
  fromPriority: Priority | null;
  toPriority: Priority | null;
  note: string | null;
}

const EVENT_LABELS: Record<EventType, string> = {
  CREATED: "Complaint raised",
  STATUS_CHANGED: "Status changed",
  PRIORITY_CHANGED: "Priority changed",
  ESCALATED: "Escalated",
  DEESCALATED: "De-escalated",
  NOTE_ADDED: "Note added",
};

// One dot color per event type, so the shape of a complaint's history is
// readable from the color column alone before reading any text.
const EVENT_DOT: Record<EventType, string> = {
  CREATED: "bg-slate-500",
  STATUS_CHANGED: "bg-sky-600",
  PRIORITY_CHANGED: "bg-indigo-500",
  ESCALATED: "bg-orange-500",
  DEESCALATED: "bg-slate-400",
  NOTE_ADDED: "bg-slate-400",
};

function describeEvent(event: TimelineEvent): string | null {
  switch (event.type) {
    case "STATUS_CHANGED":
      return `${event.fromStatus?.replace("_", " ")} → ${event.toStatus?.replace("_", " ")}`;
    case "PRIORITY_CHANGED":
      return `${event.fromPriority} → ${event.toPriority}`;
    default:
      return null;
  }
}

export function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col gap-6 border-l-2 border-slate-200 pl-6">
      {events.map((event) => {
        const detail = describeEvent(event);
        return (
          <li key={event.id} className="relative">
            <span
              className={`absolute -left-[31px] top-0.5 h-3.5 w-3.5 rounded-full ring-4 ring-white ${EVENT_DOT[event.type]}`}
              aria-hidden
            />
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <span className="text-sm font-medium text-slate-900">{EVENT_LABELS[event.type]}</span>
              <span className="text-xs text-slate-400">{new Date(event.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-500">by {event.actor.name}</p>
            {detail && <p className="mt-0.5 text-xs font-medium text-slate-600">{detail}</p>}
            {event.note && (
              <p className="mt-1.5 max-w-prose rounded-md bg-slate-50 px-3 py-2 text-sm italic text-slate-700">
                &ldquo;{event.note}&rdquo;
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}

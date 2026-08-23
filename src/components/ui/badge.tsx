import type { Status, Priority } from "@prisma/client";

// The badge system for this app, in one place:
//
// - Status is a filled, tinted pill with a leading dot — sky (open), amber
//   (in progress), emerald (resolved).
// - Priority is an outlined pill (border only, no fill) — the different
//   shape reads as "this is a different axis" at a glance, even where a hue
//   is reused (priority MEDIUM and status IN_PROGRESS are both amber).
// - Overdue is solid red with a warning glyph — the loudest badge in the
//   system, deliberately, since it has to be unmissable in a dense table.
// - Escalated, regressed, and important are solid single-color pills, each
//   a color used nowhere else in the badge system, so none of them can be
//   mistaken for status, priority, or overdue.
//
// The one accent color (indigo) never appears here — it's reserved for
// primary actions and links, not complaint metadata.

const STATUS_STYLES: Record<Status, { bg: string; dot: string }> = {
  OPEN: { bg: "bg-sky-50 text-sky-700 ring-1 ring-inset ring-sky-200", dot: "bg-sky-600" },
  IN_PROGRESS: { bg: "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200", dot: "bg-amber-600" },
  RESOLVED: { bg: "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200", dot: "bg-emerald-600" },
};

const STATUS_LABELS: Record<Status, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  RESOLVED: "Resolved",
};

export function StatusBadge({ status, className = "" }: { status: Status; className?: string }) {
  const style = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${style.bg} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  );
}

const PRIORITY_STYLES: Record<Priority, string> = {
  LOW: "border-slate-300 text-slate-600",
  MEDIUM: "border-amber-400 text-amber-700",
  HIGH: "border-rose-400 text-rose-700",
};

export function PriorityBadge({ priority, className = "" }: { priority: Priority; className?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border bg-white px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[priority]} ${className}`}
    >
      {priority}
    </span>
  );
}

export function OverdueBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-red-600 px-2 py-0.5 text-xs font-semibold text-white ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M8 1.5 1 14h14L8 1.5Zm0 4a.9.9 0 0 1 .9.9v3.6a.9.9 0 1 1-1.8 0V6.4A.9.9 0 0 1 8 5.5Zm0 6.6a.95.95 0 1 1 0 1.9.95.95 0 0 1 0-1.9Z" />
      </svg>
      Overdue
    </span>
  );
}

export function EscalatedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-orange-500 px-2 py-0.5 text-xs font-medium text-white ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M8 1 4 8h2.5L5 15l7-9H9.5L11 1H8Z" />
      </svg>
      Escalated
    </span>
  );
}

export function RegressedBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-purple-600 px-2 py-0.5 text-xs font-medium text-white ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M4 4a4 4 0 0 1 6.9-2.7l.6-.6.4 3.2-3.2-.5.7-.7A2.5 2.5 0 0 0 5.5 4H4Zm8 8a4 4 0 0 1-6.9 2.7l-.6.6-.4-3.2 3.2.5-.7.7A2.5 2.5 0 0 0 10.5 12H12Z" />
      </svg>
      Regressed
    </span>
  );
}

export function ImportantBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-semibold text-white ${className}`}
    >
      <svg viewBox="0 0 16 16" className="h-3 w-3" fill="currentColor" aria-hidden>
        <path d="M8 1.2 9.9 6l5.1.4-3.9 3.3 1.2 5-4.3-2.8-4.3 2.8 1.2-5L1 6.4 6.1 6 8 1.2Z" />
      </svg>
      Important
    </span>
  );
}

import { ImportantBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

interface NoticeListItem {
  id: string;
  title: string;
  body: string;
  isImportant: boolean;
  createdAt: string | Date;
  postedBy: { name: string };
}

export function NoticeList({ notices }: { notices: NoticeListItem[] }) {
  if (notices.length === 0) {
    return (
      <EmptyState title="No notices yet" description="Announcements from the management team will show up here." />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {notices.map((notice) => (
        <li
          key={notice.id}
          className={`rounded-lg border bg-white p-4 shadow-sm ${
            notice.isImportant ? "border-amber-300" : "border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <h2 className="font-medium text-slate-900">{notice.title}</h2>
            {notice.isImportant && <ImportantBadge className="shrink-0" />}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{notice.body}</p>
          <p className="mt-3 text-xs text-slate-400">
            Posted by {notice.postedBy.name} on {new Date(notice.createdAt).toLocaleDateString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

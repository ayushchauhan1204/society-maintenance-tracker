import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listNotices } from "@/lib/notices/queries";
import { NoticeForm } from "@/components/admin/notice-form";

export default async function AdminNoticesPage() {
  const session = await getServerSession(authOptions);
  const notices = await listNotices(session);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Notice board</h1>

      <NoticeForm />

      {notices.length === 0 ? (
        <p className="text-sm text-gray-600">No notices yet.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {notices.map((notice) => (
            <li
              key={notice.id}
              className={`rounded border bg-white p-4 ${
                notice.isImportant ? "border-red-300" : "border-gray-200"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-medium">{notice.title}</h2>
                {notice.isImportant && (
                  <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-700">
                    Important
                  </span>
                )}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{notice.body}</p>
              <p className="mt-2 text-xs text-gray-500">
                Posted by {notice.postedBy.name} on {new Date(notice.createdAt).toLocaleDateString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

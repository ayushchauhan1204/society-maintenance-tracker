import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listNotices } from "@/lib/notices/queries";
import { NoticeList } from "@/components/notice-list";

export default async function ResidentNoticesPage() {
  const session = await getServerSession(authOptions);
  const notices = await listNotices(session);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notice board</h1>
        <p className="mt-1 text-sm text-slate-500">Announcements from the management team, newest first.</p>
      </div>

      <NoticeList notices={notices} />
    </div>
  );
}

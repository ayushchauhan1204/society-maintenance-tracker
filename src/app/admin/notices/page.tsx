import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { listNotices } from "@/lib/notices/queries";
import { NoticeForm } from "@/components/admin/notice-form";
import { NoticeList } from "@/components/notice-list";

export default async function AdminNoticesPage() {
  const session = await getServerSession(authOptions);
  const notices = await listNotices(session);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Notice board</h1>
        <p className="mt-1 text-sm text-slate-500">Post an announcement — important ones pin to the top and email every resident.</p>
      </div>

      <NoticeForm />

      <NoticeList notices={notices} />
    </div>
  );
}

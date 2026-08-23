import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { SignOutButton } from "@/components/sign-out-button";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Middleware already guards this path; this is the page-level fallback for
  // server components rendered without going through it (e.g. direct RSC hits).
  if (!session || session.user.role !== "RESIDENT") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/resident" className="font-semibold">
              Society Tracker
            </Link>
            <nav className="flex gap-4 text-sm text-gray-600">
              <Link href="/resident" className="hover:text-gray-900">
                Complaints
              </Link>
              <Link href="/resident/notices" className="hover:text-gray-900">
                Notices
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{session.user.name}</span>
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

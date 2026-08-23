import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { AppHeader } from "@/components/app-header";

export default async function ResidentLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  // Middleware already guards this path; this is the page-level fallback for
  // server components rendered without going through it (e.g. direct RSC hits).
  if (!session || session.user.role !== "RESIDENT") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader role="RESIDENT" userName={session.user.name ?? ""} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}

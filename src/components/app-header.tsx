"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton } from "@/components/sign-out-button";

interface NavLink {
  href: string;
  label: string;
}

const RESIDENT_NAV: NavLink[] = [
  { href: "/resident", label: "Complaints" },
  { href: "/resident/notices", label: "Notices" },
];

const ADMIN_NAV: NavLink[] = [
  { href: "/admin", label: "Queue" },
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/notices", label: "Notices" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/system", label: "System" },
];

// The one real app shell in this project — used by both the resident and
// admin layouts, differing only in which nav links and role tag it shows.
export function AppHeader({ role, userName }: { role: "RESIDENT" | "ADMIN"; userName: string }) {
  const pathname = usePathname();
  const homeHref = role === "ADMIN" ? "/admin" : "/resident";
  const links = role === "ADMIN" ? ADMIN_NAV : RESIDENT_NAV;

  function isActive(href: string): boolean {
    if (href === homeHref) return pathname === href;
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-6 sm:gap-8">
          <Link href={homeHref} className="flex shrink-0 items-center gap-2 font-semibold text-slate-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600 text-sm font-bold text-white">
              C
            </span>
            <span className="hidden sm:inline">CommunityDesk</span>
          </Link>
          <nav className="flex items-center gap-1 overflow-x-auto">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive(link.href)
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {role === "ADMIN" && (
            <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 sm:inline">
              Admin
            </span>
          )}
          <span className="hidden max-w-[10rem] truncate text-sm text-slate-600 sm:inline">{userName}</span>
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}

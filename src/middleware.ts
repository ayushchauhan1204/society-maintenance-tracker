import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

// Unauthenticated requests to /resident/* or /admin/* redirect to /login
// (withAuth's default `authorized` callback: true only when a token exists).
// Role mismatches redirect to the section that matches the session's role.
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    const path = req.nextUrl.pathname;

    if (path.startsWith("/admin") && role !== "ADMIN") {
      return NextResponse.redirect(new URL("/resident", req.url));
    }
    if (path.startsWith("/resident") && role !== "RESIDENT") {
      return NextResponse.redirect(new URL("/login", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
  },
);

export const config = {
  matcher: ["/resident/:path*", "/admin/:path*"],
};

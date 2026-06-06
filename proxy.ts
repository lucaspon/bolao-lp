import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "bolao_session";
const PUBLIC_PATHS = ["/login"];

// Redirects unauthenticated visitors to /login (and authenticated ones away from
// it). This is a UX guard — pages and actions still verify the session for real.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(COOKIE_NAME);
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path));

  if (!hasSession && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasSession && isPublic) {
    return NextResponse.redirect(new URL("/matches", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/).*)"],
};

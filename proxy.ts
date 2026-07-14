import { NextRequest, NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  sanitizeReturnPath,
  verifySessionCookieValue,
} from "./src/auth/session";

const PROTECTED_PATHS = ["/", "/habits", "/assignments", "/courses", "/inbox"];

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  );
}

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/api/login");
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authenticated = verifySessionCookieValue(
    request.cookies.get(AUTH_COOKIE_NAME)?.value,
    process.env.ARES_AUTH_SECRET,
  );

  if (authenticated && pathname === "/login") {
    const destination = request.nextUrl.clone();
    destination.pathname = sanitizeReturnPath(request.nextUrl.searchParams.get("next"));
    destination.search = "";
    return NextResponse.redirect(destination);
  }

  if (isPublicPath(pathname) || !isProtectedPath(pathname) || authenticated) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api)(.*)",
  ],
};

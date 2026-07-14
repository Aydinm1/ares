import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  createSessionCookieValue,
  sanitizeReturnPath,
  sessionMaxAgeSeconds,
  verifyPassword,
} from "../../../src/auth/session";

export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const formData = await request.formData();
  const password = String(formData.get("password") ?? "");
  const next = sanitizeReturnPath(String(formData.get("next") ?? "/habits"));
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("next", next);

  if (!verifyPassword(password, process.env.ARES_AUTH_PASSWORD_HASH)) {
    loginUrl.searchParams.set("error", "1");
    return NextResponse.redirect(loginUrl, 303);
  }

  const response = NextResponse.redirect(new URL(next, request.url), 303);
  response.cookies.set(
    AUTH_COOKIE_NAME,
    createSessionCookieValue(process.env.ARES_AUTH_SECRET),
    {
      httpOnly: true,
      maxAge: sessionMaxAgeSeconds(),
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
  );
  return response;
}

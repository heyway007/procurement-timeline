import { NextResponse } from "next/server";
import { AuthError } from "./errors";
import { SESSION_SECONDS } from "./service";

export const authHeaders = { "Cache-Control": "no-store, private", Pragma: "no-cache", Vary: "Cookie" };
export const sessionCookieName = (production = process.env.NODE_ENV === "production") => production ? "__Host-timeline-session" : "timeline-session";
export const sessionCookieOptions = (production = process.env.NODE_ENV === "production") => ({ httpOnly: true, secure: production, sameSite: "lax" as const, path: "/", maxAge: SESSION_SECONDS });
export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin || origin !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") throw new AuthError("FORBIDDEN_ORIGIN", 403);
}
export function authErrorResponse(error: unknown): NextResponse | null {
  if (!(error instanceof AuthError)) return null;
  return NextResponse.json({ error: error.code }, { status: error.status, headers: { ...authHeaders, ...(error.status === 429 ? { "Retry-After": "900" } : {}) } });
}

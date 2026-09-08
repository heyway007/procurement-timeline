import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/auth/server";
import { assertSameOrigin, authErrorResponse, authHeaders, sessionCookieName, sessionCookieOptions } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    await getAuthService().logout((await cookies()).get(sessionCookieName())?.value);
    const response = NextResponse.json({ ok: true }, { headers: authHeaders });
    response.cookies.set(sessionCookieName(), "", { ...sessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) { return authErrorResponse(error) ?? NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: authHeaders }); }
}

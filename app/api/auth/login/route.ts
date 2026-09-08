import { NextResponse } from "next/server";
import { getAuthService } from "@/lib/auth/server";
import { assertSameOrigin, authErrorResponse, authHeaders, sessionCookieName, sessionCookieOptions } from "@/lib/auth/http";
import { invalidCredentials } from "@/lib/auth/errors";

export const dynamic = "force-dynamic";
async function readLoginBody(request: Request): Promise<string> {
  if (!request.body) throw invalidCredentials();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 4096) {
        await reader.cancel();
        throw invalidCredentials();
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw invalidCredentials();
    const text = await readLoginBody(request);
    let body: unknown;
    try { body = JSON.parse(text); } catch { throw invalidCredentials(); }
    if (!body || typeof body !== "object" || !("email" in body) || !("password" in body) || typeof body.email !== "string" || typeof body.password !== "string") throw invalidCredentials();
    const { user, token } = await getAuthService().login(body.email, body.password);
    const response = NextResponse.json({ user }, { headers: authHeaders });
    response.cookies.set(sessionCookieName(), token, sessionCookieOptions());
    return response;
  } catch (error) {
    return authErrorResponse(error) ?? NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: authHeaders });
  }
}

import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth/server";
import { authErrorResponse, authHeaders } from "@/lib/auth/http";

export const dynamic = "force-dynamic";
export async function GET() {
  try { return NextResponse.json({ user: await requireUser() }, { headers: authHeaders }); }
  catch (error) { return authErrorResponse(error) ?? NextResponse.json({ error: "AUTH_UNAVAILABLE" }, { status: 503, headers: authHeaders }); }
}

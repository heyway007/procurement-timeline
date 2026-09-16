import { NextResponse } from "next/server";
import { authHeaders } from "@/lib/auth/http";

export const dynamic = "force-dynamic";

// Login is paused while Timeline is shared by all visitors.
export async function POST() {
  return NextResponse.json({ error: "LOGIN_DISABLED" }, { status: 410, headers: authHeaders });
}

import { privateJson } from "@/lib/http/private-response";
import { NextResponse } from "next/server";
import { mapProjectError } from "./http";
import { authErrorResponse } from "@/lib/auth/http";

export function projectErrorResponse(error: unknown): NextResponse {
  const authError = authErrorResponse(error);
  if (authError) return authError;
  const mapped = mapProjectError(error);
  return privateJson(mapped.body, { status: mapped.status });
}

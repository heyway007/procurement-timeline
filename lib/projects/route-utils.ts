import { NextResponse } from "next/server";
import { mapProjectError } from "./http";

export function projectErrorResponse(error: unknown): NextResponse {
  const mapped = mapProjectError(error);
  return NextResponse.json(mapped.body, { status: mapped.status });
}

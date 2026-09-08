import { privateJson } from "@/lib/http/private-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { token: string };
    const service = await getHolidayService(request);
    const result = await service.confirmMutation(body.token);
    return privateJson({
      updatedProjectCount: result.updatedProjectIds.length,
      needsReviewProjectCount: result.needsReviewProjectIds.length,
      versionConflictProjectCount: result.versionConflictProjectIds.length,
    });
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

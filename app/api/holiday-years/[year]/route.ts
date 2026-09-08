import { privateJson } from "@/lib/http/private-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

type RouteContext = { params: Promise<{ year: string }> };

export async function PUT(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { year } = await context.params;
    const body = (await request.json()) as { sourceNote: string };
    const service = await getHolidayService(request);
    return privateJson({
      coverage: await service.verifyYear(
        Number(year),
        body.sourceNote,
      ),
    });
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

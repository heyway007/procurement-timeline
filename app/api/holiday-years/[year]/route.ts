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
    return NextResponse.json({
      coverage: await getHolidayService().verifyYear(
        Number(year),
        body.sourceNote,
      ),
    });
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const year = Number(request.nextUrl.searchParams.get("year"));
    return NextResponse.json(await getHolidayService().listAndSyncYear(year));
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

import { privateJson } from "@/lib/http/private-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService, getHolidaySyncCoordinator } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const year = Number(request.nextUrl.searchParams.get("year"));
    const coordinator = await getHolidaySyncCoordinator();
    return privateJson(await coordinator.syncYear(year));
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const service = await getHolidayService(request);
    const { year } = await request.json() as { year: number };
    return privateJson(await service.listAndSyncYear(year, true));
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

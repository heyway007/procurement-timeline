import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const service = await getHolidayService();
    return NextResponse.json(
      await service.previewMutation(await request.json()),
    );
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

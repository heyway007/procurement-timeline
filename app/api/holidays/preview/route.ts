import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    return NextResponse.json(
      await getHolidayService().previewMutation(await request.json()),
    );
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

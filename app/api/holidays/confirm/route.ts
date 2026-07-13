import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as { token: string };
    const service = await getHolidayService();
    return NextResponse.json(
      await service.confirmMutation(body.token),
    );
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

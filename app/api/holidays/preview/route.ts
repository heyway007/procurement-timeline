import { privateJson } from "@/lib/http/private-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getHolidayService } from "@/lib/holidays/container";
import { holidayErrorResponse } from "@/lib/holidays/route-utils";
import { requireAdmin } from "@/lib/auth/server";

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const service = await getHolidayService(request);
    const viewer = await requireAdmin();
    return privateJson(
      await service.previewMutation(await request.json(), viewer.id),
    );
  } catch (error: unknown) {
    return holidayErrorResponse(error);
  }
}

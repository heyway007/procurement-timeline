import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectService } from "@/lib/projects/container";
import { projectErrorResponse } from "@/lib/projects/route-utils";

type RouteContext = { params: Promise<{ id: string; order: string }> };

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id, order } = await context.params;
    const body = (await request.json()) as {
      newDate: string;
      version: number;
      confirmShortening?: boolean;
      confirmOverwrite?: boolean;
    };
    const service = await getProjectService();
    const project = await service.adjustStep(id, {
      order: Number(order),
      newDate: body.newDate,
      version: body.version,
      confirmShortening: body.confirmShortening ?? false,
      confirmOverwrite: body.confirmOverwrite ?? false,
    });
    return NextResponse.json({ project });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

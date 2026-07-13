import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectService } from "@/lib/projects/container";
import { projectErrorResponse } from "@/lib/projects/route-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { version: number };
    const service = await getProjectService();
    const project = await service.resetSchedule(id, body.version);
    return NextResponse.json({ project });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

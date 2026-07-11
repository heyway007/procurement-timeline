import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectService } from "@/lib/projects/container";
import { projectErrorResponse } from "@/lib/projects/route-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as {
      newDate: string;
      version: number;
      confirmShortening?: boolean;
    };
    const project = await getProjectService().adjustEnd(
      id,
      body.newDate,
      body.version,
      body.confirmShortening ?? false,
    );
    return NextResponse.json({ project });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

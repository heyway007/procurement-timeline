import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectService } from "@/lib/projects/container";
import { projectErrorResponse } from "@/lib/projects/route-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  _request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const service = await getProjectService();
    return NextResponse.json({ project: await service.get(id) });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const service = await getProjectService();
    const project = await service.updateDetails(
      id,
      await request.json(),
    );
    return NextResponse.json({ project });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const body = (await request.json()) as { version: number };
    const service = await getProjectService();
    await service.remove(id, body.version);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

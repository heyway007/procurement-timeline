import { privateJson } from "@/lib/http/private-response";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectService } from "@/lib/projects/container";
import { projectErrorResponse } from "@/lib/projects/route-utils";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const service = await getProjectService(request);
    return privateJson({ project: await service.get(id) });
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
    const service = await getProjectService(request);
    const project = await service.updateDetails(
      id,
      await request.json(),
    );
    return privateJson({ project });
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
    const service = await getProjectService(request);
    await service.remove(id, body.version);
    return new NextResponse(null, { status: 204 });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

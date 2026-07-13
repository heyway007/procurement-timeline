import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getProjectService } from "@/lib/projects/container";
import { projectErrorResponse } from "@/lib/projects/route-utils";

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const search = request.nextUrl.searchParams;
    const service = await getProjectService();
    const projects = await service.list({
      query: search.get("query") || undefined,
      from: search.get("from") || undefined,
      to: search.get("to") || undefined,
    });
    return NextResponse.json({ projects });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const service = await getProjectService();
    const result = await service.create(await request.json());
    return NextResponse.json(result, { status: 201 });
  } catch (error: unknown) {
    return projectErrorResponse(error);
  }
}

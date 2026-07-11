import type {
  CreateProjectInput,
  ListProjectsFilter,
  ProjectRecord,
} from "@/lib/projects/types";

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function requestJson<T>(
  input: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const body = (await response.json()) as T & { code?: string; message?: string };
  if (!response.ok) {
    throw new ApiError(
      body.code ?? "INTERNAL_ERROR",
      body.message ?? "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
      response.status,
    );
  }
  return body;
}

export async function getProjects(
  filter: ListProjectsFilter = {},
): Promise<ProjectRecord[]> {
  const search = new URLSearchParams();
  if (filter.query) search.set("query", filter.query);
  if (filter.from) search.set("from", filter.from);
  if (filter.to) search.set("to", filter.to);
  const result = await requestJson<{ projects: ProjectRecord[] }>(
    `/api/projects?${search.toString()}`,
  );
  return result.projects;
}

export async function createProject(input: CreateProjectInput): Promise<{
  project: ProjectRecord;
  unverifiedCalendarYears: number[];
}> {
  return requestJson("/api/projects", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

import type {
  CreateProjectInput,
  ListProjectsFilter,
  ProjectRecord,
} from "@/lib/projects/types";
import type { BidSubmissionTimeSlot } from "@/lib/schedule/milestone-kind";

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
  const body = await parseJsonBody<T & { code?: string; message?: string }>(
    response,
  );
  if (!response.ok) {
    throw new ApiError(
      body.code ?? "INTERNAL_ERROR",
      body.message ?? genericErrorMessage,
      response.status,
    );
  }
  return body;
}

const genericErrorMessage = "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง";

async function parseJsonBody<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/json")) {
    if (!response.ok) return {} as T;
    throw new ApiError("INTERNAL_ERROR", genericErrorMessage, response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError("INTERNAL_ERROR", genericErrorMessage, response.status);
  }
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

export async function getProject(id: string): Promise<ProjectRecord> {
  const result = await requestJson<{ project: ProjectRecord }>(
    `/api/projects/${id}`,
  );
  return result.project;
}

export async function adjustProjectStep(
  id: string,
  order: number,
  newDate: string,
  version: number,
  confirmShortening = false,
  confirmOverwrite = false,
): Promise<ProjectRecord> {
  const result = await requestJson<{ project: ProjectRecord }>(
    `/api/projects/${id}/steps/${order}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        newDate,
        version,
        confirmShortening,
        confirmOverwrite,
      }),
    },
  );
  return result.project;
}

export async function resetProjectSchedule(
  id: string,
  version: number,
): Promise<ProjectRecord> {
  const result = await requestJson<{ project: ProjectRecord }>(
    `/api/projects/${id}/reset-schedule`,
    { method: "POST", body: JSON.stringify({ version }) },
  );
  return result.project;
}

export async function updateBidSubmissionTime(
  id: string,
  timeSlot: BidSubmissionTimeSlot,
  version: number,
): Promise<ProjectRecord> {
  const result = await requestJson<{ project: ProjectRecord }>(
    `/api/projects/${id}/bid-submission-time`,
    {
      method: "PATCH",
      body: JSON.stringify({ timeSlot, version }),
    },
  );
  return result.project;
}

export async function deleteProject(id: string, version: number): Promise<void> {
  const response = await fetch(`/api/projects/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ version }),
  });
  if (!response.ok) {
    const body = await parseJsonBody<{ code?: string; message?: string }>(
      response,
    );
    throw new ApiError(
      body.code ?? "INTERNAL_ERROR",
      body.message ?? "ไม่สามารถลบโครงการได้",
      response.status,
    );
  }
}

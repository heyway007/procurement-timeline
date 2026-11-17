import { afterEach, describe, expect, it, vi } from "vitest";
import { adjustProjectStep, ApiError, updateBidSubmissionTime, updateProjectDetails } from "@/lib/ui/api-client";

describe("api client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("turns non-JSON server responses into a readable ApiError", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("<!DOCTYPE html><html></html>", {
          status: 500,
          headers: { "Content-Type": "text/html" },
        }),
      ),
    );

    await expect(
      adjustProjectStep("project-1", 2, "2026-07-17", 1),
    ).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "ระบบขัดข้อง กรุณาลองใหม่อีกครั้ง",
      status: 500,
    } satisfies Partial<ApiError>);
  });

  it("sends the selected bid submission slot immediately", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ project: { id: "project-1" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    await updateBidSubmissionTime("project-1", "AFTERNOON", 2);

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1/bid-submission-time",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ timeSlot: "AFTERNOON", version: 2 }) }),
    );
  });

  it("patches project details with the confirmed reset and returns the updated project", async () => {
    const project = { id: "project-1", budgetCategory: "SPECIFIC_METHOD_UNDER_500K", version: 3 };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ project }));
    vi.stubGlobal("fetch", fetchMock);
    const input = {
      name: "ชื่อโครงการใหม่",
      budgetCategory: "SPECIFIC_METHOD_UNDER_500K",
      startDate: "2026-07-06",
      version: 2,
      confirmReset: true,
    } as const;

    await expect(updateProjectDetails(project.id, input)).resolves.toEqual(project);
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/projects/project-1",
      expect.objectContaining({ method: "PATCH", body: JSON.stringify(input) }),
    );
  });
});

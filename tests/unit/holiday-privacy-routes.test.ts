// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ preview: vi.fn(), confirm: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ requireAdmin: async () => ({ id: "signed-in-admin", role: "ADMIN" }) }));
vi.mock("@/lib/holidays/container", () => ({ getHolidayService: async () => ({ previewMutation: state.preview, confirmMutation: state.confirm }) }));
import { POST as preview } from "@/app/api/holidays/preview/route";
import { POST as confirm } from "@/app/api/holidays/confirm/route";
const request = (body: unknown) => new NextRequest("https://timeline.example/api/holidays", { method: "POST", headers: { "Content-Type": "application/json", origin: "https://timeline.example" }, body: JSON.stringify(body) });

describe("holiday project privacy at HTTP boundary", () => {
  beforeEach(() => vi.resetAllMocks());
  it("shows all affected projects without accepting a client supplied owner filter", async () => {
    state.preview.mockImplementation(async (_mutation, viewer) => ({ affectedProjectCount: 2, affectedProjects: viewer === undefined ? [{ id: "own" }, { id: "foreign" }] : [], token: "encrypted" }));
    const response = await preview(request({ operation: "delete", id: "holiday", date: "2026-07-10", viewerUserId: "other" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ affectedProjectCount: 2, affectedProjects: [{ id: "own" }, { id: "foreign" }], token: "encrypted" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("returns aggregate confirmation counts without project IDs", async () => {
    state.confirm.mockResolvedValue({ updatedProjectIds: ["own", "foreign"], needsReviewProjectIds: ["private-review"], versionConflictProjectIds: ["private-conflict"] });
    const response = await confirm(request({ token: "encrypted" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ updatedProjectCount: 2, needsReviewProjectCount: 1, versionConflictProjectCount: 1 });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

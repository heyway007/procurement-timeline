// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GoogleDriveDataStore, createEmptyGoogleDriveDocument } from "@/lib/google-drive/datastore";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";

const state = vi.hoisted(() => ({ store: undefined as unknown }));
vi.mock("@/lib/google-drive/container", () => ({ getGoogleDriveDataStore: () => state.store }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }), headers: async () => new Headers() }));
import { GET, POST } from "@/app/api/projects/route";
import { GET as detail, DELETE } from "@/app/api/projects/[id]/route";
import { GET as holidays } from "@/app/api/holidays/route";

afterEach(() => vi.unstubAllEnvs());

describe("shared project access without sessions", () => {
  it("creates projects with entered names and exposes unassigned and other users' projects", async () => {
    vi.stubEnv("STORAGE_MODE", "google_drive");
    vi.stubEnv("HOLIDAY_PREVIEW_SECRET", "shared-test-preview-secret");
    let content = JSON.stringify(createEmptyGoogleDriveDocument("2026-09-16T00:00:00.000Z"));
    const store = new GoogleDriveDataStore({ readText: async () => content, writeText: async (value) => { content = value; } });
    state.store = store;
    const repository = new GoogleDriveProjectRepository(store);
    const request = (method = "GET", body?: unknown) => new NextRequest("https://timeline.example/api/projects", {
      method, headers: { Origin: "https://timeline.example", "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const createdResponse = await POST(request("POST", { ownerName: "ผู้จัดทำเอง", startDate: "2026-07-06", budgetCategory: "TEN_TO_TWENTY_MILLION", projectStatusType: "SLA_COMPLIANT" }));
    expect(createdResponse.status).toBe(201);
    const { project } = await createdResponse.json();
    expect(project.ownerName).toBe("ผู้จัดทำเอง");
    expect(project.ownerUserId ?? null).toBeNull();
    await store.mutate(document => {
      document.projects.push({ ...project, id: "other-user-project", ownerUserId: "another-user", name: "Other user project" });
    });
    const list = await GET(request());
    expect(list.status).toBe(200);
    expect((await list.json()).projects).toHaveLength(2);
    const context = { params: Promise.resolve({ id: "other-user-project" }) };
    const other = await detail(request(), context);
    expect(other.status).toBe(200);
    expect((await other.json()).project.name).toBe("Other user project");
    const calendar = await holidays(new NextRequest("https://timeline.example/api/holidays?year=2026"));
    expect(calendar.status).toBe(200);
    const removed = await DELETE(request("DELETE", { version: 1 }), context);
    expect(removed.status).toBe(204);
    expect(await repository.findById("other-user-project")).toBeNull();
  });
});

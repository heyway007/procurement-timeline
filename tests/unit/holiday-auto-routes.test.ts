// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { HolidaySyncCoordinator } from "@/lib/holidays/sync-coordinator";
import { GoogleDriveDataStore, createEmptyGoogleDriveDocument } from "@/lib/google-drive/datastore";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";

const state = vi.hoisted(() => ({ coordinator: null as unknown as HolidaySyncCoordinator, repository: null as unknown as GoogleDriveHolidayRepository }));
vi.mock("@/lib/holidays/container", () => ({
  getHolidaySyncCoordinator: async () => state.coordinator,
  getHolidayService: async () => ({ listYear: (year: number) => state.repository.listYear(year), listAndSyncYear: (year: number, force: boolean) => state.coordinator.syncYear(year, force) }),
}));
import { GET } from "@/app/api/holidays/route";

describe("automatic calendar HTTP reads", () => {
  beforeEach(() => {
    let content = JSON.stringify(createEmptyGoogleDriveDocument("2026-11-26T00:00:00.000Z"));
    const store = new GoogleDriveDataStore({ readText: async () => content, writeText: async (next) => { content = next; } });
    state.repository = new GoogleDriveHolidayRepository(store, new GoogleDriveProjectRepository(store));
    const holidays = [{ date: "2027-02-23", name: "วันหยุดตามประกาศจริง", scope: "NATIONWIDE" as const, sourceUrl: "https://www.soc.go.th/?p=2027", sourceLabel: "สลค." }];
    state.coordinator = new HolidaySyncCoordinator(state.repository, {
      sourceUrl: () => holidays[0].sourceUrl,
      fetchYear: async () => holidays,
      fetchCalendarYear: async () => ({ holidays, coverage: "FULL_YEAR", cached: false }),
    });
  });

  it("imports a newly published official year on GET without a manual sync", async () => {
    const response = await GET(new NextRequest("https://timeline.example/api/holidays?year=2027"));
    const result = await response.json();
    expect(response.status).toBe(200);
    expect(result.sync.status).toBe("FRESH");
    expect(result.holidays).toEqual([expect.objectContaining({ date: "2027-02-23", origin: "OFFICIAL_SYNC" })]);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

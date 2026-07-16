import { describe, expect, it } from "vitest";
import { GoogleDriveDataStore, createEmptyGoogleDriveDocument, type GoogleDriveFileClient } from "@/lib/google-drive/datastore";
import { GoogleDriveHolidayRepository } from "@/lib/google-drive/holiday-repository";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import { APPROVED_TEMPLATE_KEY } from "@/lib/schedule/approved-template";

class FakeDriveFileClient implements GoogleDriveFileClient {
  constructor(public content: string | null) {}
  async readText(): Promise<string | null> {
    return this.content;
  }
  async writeText(content: string): Promise<void> {
    this.content = content;
  }
}

const nowIso = "2026-07-12T12:00:00.000Z";

function dataStore() {
  return new GoogleDriveDataStore(
    new FakeDriveFileClient(JSON.stringify(createEmptyGoogleDriveDocument(nowIso))),
    () => nowIso,
  );
}

describe("GoogleDriveHolidayRepository", () => {
  it("creates, updates, deletes, and lists holidays by year", async () => {
    const store = dataStore();
    const repository = new GoogleDriveHolidayRepository(
      store,
      new GoogleDriveProjectRepository(store),
    );

    await repository.applyMutation({
      operation: "create",
      holiday: { date: "2026-07-29", name: "วันหยุด", sourceNote: "manual" },
    });
    const created = (await repository.listYear(2026)).holidays[0];
    await repository.applyMutation({
      operation: "update",
      id: created.id,
      previousDate: created.date,
      holiday: { date: "2026-07-30", name: "วันหยุดแก้ไข", sourceNote: "manual 2" },
    });

    expect((await repository.listAllDates())).toEqual(new Set(["2026-07-30"]));
    expect((await repository.listYear(2026)).holidays[0]).toMatchObject({
      date: "2026-07-30",
      name: "วันหยุดแก้ไข",
      origin: "MANUAL",
      scope: "NATIONWIDE",
    });

    await repository.applyMutation({
      operation: "delete",
      id: created.id,
      date: "2026-07-30",
    });
    expect((await repository.listYear(2026)).holidays).toEqual([]);
  });

  it("verifies years and records sync failures", async () => {
    const store = dataStore();
    const repository = new GoogleDriveHolidayRepository(
      store,
      new GoogleDriveProjectRepository(store),
    );

    const verified = await repository.verifyYear(2026, "checked");
    await repository.recordSyncFailure(2027, "2026-07-12T13:00:00.000Z", "offline");

    expect(verified).toMatchObject({
      year: 2026,
      isVerifiedComplete: true,
      sourceNote: "checked",
    });
    expect((await repository.listYear(2027)).coverage).toMatchObject({
      year: 2027,
      lastSyncStatus: "FAILED",
      lastSyncMessage: "offline",
    });
  });

  it("lists projects affected by holiday dates", async () => {
    const store = dataStore();
    const projects = new GoogleDriveProjectRepository(store);
    await projects.create({
      name: "City Expo",
      ownerName: "POND",
      budget: 29000000,
      budgetCategory: "TEN_TO_TWENTY_MILLION",
      startDate: "2026-07-13",
      note: "",
      templateKey: APPROVED_TEMPLATE_KEY,
      templateVersion: 1,
      processEndDate: "2026-09-04",
      isProcessEndManuallyAdjusted: false,
      scheduleStatus: "NORMAL",
      steps: [],
    });
    const repository = new GoogleDriveHolidayRepository(store, projects);

    expect((await repository.listAffectedProjects(["2026-07-29"])).map((project) => project.name)).toEqual(["City Expo"]);
    expect(await repository.listAffectedProjects(["2026-10-01"])).toEqual([]);
  });

  it("reconciles official holidays while preserving manual conflicts", async () => {
    const store = dataStore();
    const repository = new GoogleDriveHolidayRepository(
      store,
      new GoogleDriveProjectRepository(store),
    );
    await repository.applyMutation({
      operation: "create",
      holiday: { date: "2026-10-13", name: "manual", sourceNote: "manual" },
    });

    const result = await repository.reconcileOfficialYear(
      2026,
      [
        {
          date: "2026-10-13",
          name: "official conflict",
          scope: "NATIONWIDE",
          sourceUrl: "https://www.soc.go.th/",
          sourceLabel: "สลค.",
        },
        {
          date: "2026-12-10",
          name: "official new",
          scope: "NATIONWIDE",
          sourceUrl: "https://www.soc.go.th/",
          sourceLabel: "สลค.",
        },
      ],
      "2026-07-12T13:00:00.000Z",
    );

    const year = await repository.listYear(2026);
    expect(result).toEqual({ inserted: 1, updated: 0, conflicts: ["2026-10-13"] });
    expect(year.holidays.find((holiday) => holiday.date === "2026-10-13")?.name).toBe("manual");
    expect(year.holidays.find((holiday) => holiday.date === "2026-12-10")).toMatchObject({
      origin: "OFFICIAL_SYNC",
      lastConfirmedAt: "2026-07-12T13:00:00.000Z",
    });
    expect(year.coverage).toMatchObject({
      lastSyncStatus: "FRESH",
      lastSuccessfulSyncAt: "2026-07-12T13:00:00.000Z",
    });
  });
});

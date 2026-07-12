import { describe, expect, it } from "vitest";
import { GoogleDriveDataStore, createEmptyGoogleDriveDocument, type GoogleDriveFileClient } from "@/lib/google-drive/datastore";
import { GoogleDriveProjectRepository } from "@/lib/google-drive/project-repository";
import type { NewProjectRecord, ProjectReplacement } from "@/lib/projects/types";
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

function store(now = "2026-07-12T12:00:00.000Z") {
  return new GoogleDriveDataStore(
    new FakeDriveFileClient(JSON.stringify(createEmptyGoogleDriveDocument(now))),
    () => now,
  );
}

function newProject(name = "City Expo"): NewProjectRecord {
  return {
    name,
    ownerName: "POND",
    budget: 29000000,
    budgetCategory: "ABOVE_TWENTY_MILLION",
    startDate: "2026-07-13",
    note: "",
    templateKey: APPROVED_TEMPLATE_KEY,
    templateVersion: 1,
    processEndDate: "2026-09-04",
    isProcessEndManuallyAdjusted: false,
    scheduleStatus: "NORMAL",
    steps: [
      {
        order: 1,
        label: "เริ่ม",
        workingDaysToNext: 4,
        scheduledDate: "2026-07-13",
        isDateManuallyAdjusted: false,
      },
    ],
  };
}

describe("GoogleDriveProjectRepository", () => {
  it("creates, finds, and lists projects by updated date descending", async () => {
    const repository = new GoogleDriveProjectRepository(store());

    const first = await repository.create(newProject("City Expo"));
    await repository.create(newProject("Roadshow"));

    expect(first.version).toBe(1);
    expect(await repository.findById(first.id)).toMatchObject({ name: "City Expo" });
    expect((await repository.list({})).map((project) => project.name)).toEqual([
      "Roadshow",
      "City Expo",
    ]);
  });

  it("filters projects by query and date window", async () => {
    const repository = new GoogleDriveProjectRepository(store());
    await repository.create(newProject("City Expo"));
    await repository.create({
      ...newProject("Hospital"),
      ownerName: "MAY",
      startDate: "2026-10-01",
      processEndDate: "2026-11-01",
    });

    expect((await repository.list({ query: "pond" })).map((project) => project.name)).toEqual(["City Expo"]);
    expect((await repository.list({ from: "2026-09-15", to: "2026-12-01" })).map((project) => project.name)).toEqual(["Hospital"]);
  });

  it("replaces projects only when the expected version matches", async () => {
    const repository = new GoogleDriveProjectRepository(store());
    const created = await repository.create(newProject());
    const replacement: ProjectReplacement = {
      ...created,
      name: "City Expo Revised",
      steps: created.steps.map((step) => ({
        ...step,
        scheduledDate: "2026-07-14",
        isDateManuallyAdjusted: true,
      })),
    };

    const result = await repository.replace(created.id, 1, replacement);
    const conflict = await repository.replace(created.id, 1, replacement);

    expect(result.kind).toBe("ok");
    expect(result.kind === "ok" ? result.project.version : 0).toBe(2);
    expect(await repository.findById(created.id)).toMatchObject({
      name: "City Expo Revised",
      steps: [expect.objectContaining({ scheduledDate: "2026-07-14" })],
    });
    expect(conflict.kind).toBe("conflict");
  });

  it("removes projects only when the expected version matches", async () => {
    const repository = new GoogleDriveProjectRepository(store());
    const created = await repository.create(newProject());

    expect((await repository.remove(created.id, 2)).kind).toBe("conflict");
    expect((await repository.remove(created.id, 1)).kind).toBe("ok");
    expect(await repository.findById(created.id)).toBeNull();
    expect((await repository.remove(created.id, 1)).kind).toBe("not_found");
  });

  it("reads holiday dates and unverified calendar years", async () => {
    const dataStore = store();
    await dataStore.mutate((document) => {
      document.holidays.push({
        id: "holiday-1",
        date: "2026-07-29",
        name: "วันหยุด",
        sourceNote: "manual",
        scope: "NATIONWIDE",
        origin: "MANUAL",
        officialSourceUrl: null,
        officialSourceLabel: null,
        lastConfirmedAt: null,
        createdAt: "2026-07-12T12:00:00.000Z",
        updatedAt: "2026-07-12T12:00:00.000Z",
      });
      document.holidayCalendarYears.push({
        year: 2026,
        isVerifiedComplete: true,
        sourceNote: "checked",
        verifiedAt: "2026-07-12T12:00:00.000Z",
        lastSyncAttemptAt: null,
        lastSuccessfulSyncAt: null,
        lastSyncStatus: null,
        lastSyncMessage: null,
      });
    });
    const repository = new GoogleDriveProjectRepository(dataStore);

    expect(await repository.listHolidayDates()).toEqual(new Set(["2026-07-29"]));
    expect(await repository.listUnverifiedYears("2026-12-01", "2027-01-15")).toEqual([2027]);
  });
});

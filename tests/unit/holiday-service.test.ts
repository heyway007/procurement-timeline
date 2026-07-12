import { describe, expect, it } from "vitest";
import type {
  HolidayMutation,
  OfficialHolidayInput,
  HolidayRecord,
  HolidayRepository,
  YearCoverageRecord,
} from "@/lib/holidays/repository";
import { HolidayService } from "@/lib/holidays/service";
import type { HolidaySource } from "@/lib/holidays/official-source";
import type {
  ProjectMutationResult,
  ProjectRepository,
} from "@/lib/projects/repository";
import type {
  ListProjectsFilter,
  NewProjectRecord,
  ProjectRecord,
  ProjectReplacement,
} from "@/lib/projects/types";
import { buildTimeline } from "@/lib/schedule/engine";
import { APPROVED_TEMPLATE_STEPS } from "@/lib/schedule/approved-template";

class FakeProjectRepository implements ProjectRepository {
  constructor(public project: ProjectRecord) {}

  async list(_filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    void _filter;
    return [this.project];
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    return id === this.project.id ? this.project : null;
  }

  async create(_input: NewProjectRecord): Promise<ProjectRecord> {
    void _input;
    return this.project;
  }

  async replace(
    id: string,
    expectedVersion: number,
    input: ProjectReplacement,
  ): Promise<ProjectMutationResult> {
    if (id !== this.project.id) return { kind: "not_found" };
    if (expectedVersion !== this.project.version) return { kind: "conflict" };
    this.project = {
      ...input,
      id,
      version: this.project.version + 1,
      createdAt: this.project.createdAt,
      updatedAt: "2026-07-12T01:00:00.000Z",
    };
    return { kind: "ok", project: this.project };
  }

  async remove(): Promise<ProjectMutationResult> {
    return { kind: "ok", project: this.project };
  }
}

class FakeHolidayRepository implements HolidayRepository {
  holidays: HolidayRecord[] = [];
  coverage: YearCoverageRecord[] = [];

  constructor(private readonly affectedProjects: ProjectRecord[]) {}

  async listYear(year: number): Promise<{
    holidays: HolidayRecord[];
    coverage: YearCoverageRecord | null;
  }> {
    return {
      holidays: this.holidays.filter((item) => item.date.startsWith(`${year}-`)),
      coverage: this.coverage.find((item) => item.year === year) ?? null,
    };
  }

  async listAffectedProjects(): Promise<ProjectRecord[]> {
    return this.affectedProjects;
  }

  async listAllDates(): Promise<ReadonlySet<string>> {
    return new Set(this.holidays.map((holiday) => holiday.date));
  }

  async applyMutation(mutation: HolidayMutation): Promise<void> {
    if (mutation.operation === "create") {
      this.holidays.push({
        id: "holiday-1",
        ...mutation.holiday,
        createdAt: "2026-07-12T00:00:00.000Z",
        updatedAt: "2026-07-12T00:00:00.000Z",
        scope: "NATIONWIDE",
        origin: "MANUAL",
        officialSourceUrl: null,
        officialSourceLabel: null,
        lastConfirmedAt: null,
      });
    }
  }

  async verifyYear(year: number, sourceNote: string): Promise<YearCoverageRecord> {
    const record = {
      year,
      isVerifiedComplete: true,
      sourceNote,
      verifiedAt: "2026-07-12T00:00:00.000Z",
      lastSyncAttemptAt: null,
      lastSuccessfulSyncAt: null,
      lastSyncStatus: null,
      lastSyncMessage: null,
    };
    this.coverage.push(record);
    return record;
  }

  async reconcileOfficialYear(
    year: number,
    official: OfficialHolidayInput[],
    confirmedAt: string,
  ) {
    const conflicts: string[] = [];
    for (const item of official) {
      const existing = this.holidays.find((holiday) => holiday.date === item.date);
      if (existing?.origin === "MANUAL") {
        conflicts.push(item.date);
        continue;
      }
      const record: HolidayRecord = {
        id: existing?.id ?? `official-${item.date}`,
        date: item.date,
        name: item.name,
        sourceNote: item.sourceLabel,
        scope: item.scope,
        origin: "OFFICIAL_SYNC",
        officialSourceUrl: item.sourceUrl,
        officialSourceLabel: item.sourceLabel,
        lastConfirmedAt: confirmedAt,
        createdAt: existing?.createdAt ?? confirmedAt,
        updatedAt: confirmedAt,
      };
      if (existing) Object.assign(existing, record);
      else this.holidays.push(record);
    }
    return { inserted: official.length - conflicts.length, updated: 0, conflicts };
  }

  async recordSyncFailure(): Promise<void> {}
}

function projectFixture(): ProjectRecord {
  const timeline = buildTimeline(
    APPROVED_TEMPLATE_STEPS,
    "2026-07-06",
    new Set(),
  );
  return {
    id: "project-1",
    name: "จัดซื้อระบบ",
    ownerName: "คุณสมชาย",
    budget: 29_000_000,
    startDate: "2026-07-06",
    note: "",
    templateKey: "procurement-29m-v1",
    templateVersion: 1,
    processEndDate: timeline.processEndDate,
    isProcessEndManuallyAdjusted: false,
    scheduleStatus: "NORMAL",
    version: 1,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    steps: timeline.milestones,
  };
}

describe("HolidayService", () => {
  it("synchronizes official holidays before returning the selected year", async () => {
    const project = projectFixture();
    const holidays = new FakeHolidayRepository([project]);
    const source: HolidaySource = {
      sourceUrl: () => "https://www.soc.go.th/?p=33672",
      fetchYear: async () => [{
        date: "2026-10-16",
        name: "วันหยุดราชการเป็นกรณีพิเศษในพื้นที่กรุงเทพมหานคร",
        scope: "BANGKOK",
        sourceUrl: "https://www.soc.go.th/?p=33672",
        sourceLabel: "สำนักเลขาธิการคณะรัฐมนตรี",
      }],
    };
    const service = new HolidayService(holidays, new FakeProjectRepository(project), "test-secret-key", source);

    const result = await service.listAndSyncYear(2026);

    expect(result.sync.status).toBe("FRESH");
    expect(result.holidays).toEqual([expect.objectContaining({ date: "2026-10-16", scope: "BANGKOK" })]);
  });

  it("returns cached holidays when the official source is unavailable", async () => {
    const project = projectFixture();
    const holidays = new FakeHolidayRepository([project]);
    holidays.holidays.push({ id: "cached", date: "2026-01-02", name: "วันหยุดพิเศษ", sourceNote: "สลค.", scope: "NATIONWIDE", origin: "OFFICIAL_SYNC", officialSourceUrl: "https://www.soc.go.th/?p=33672", officialSourceLabel: "สลค.", lastConfirmedAt: "2026-01-01T00:00:00.000Z", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z" });
    const source: HolidaySource = { sourceUrl: () => "https://www.soc.go.th/?p=33672", fetchYear: async () => { throw new Error("OFFICIAL_SOURCE_UNAVAILABLE"); } };
    const service = new HolidayService(holidays, new FakeProjectRepository(project), "test-secret-key", source);

    const result = await service.listAndSyncYear(2026);

    expect(result.sync.status).toBe("CACHED");
    expect(result.holidays).toHaveLength(1);
  });
  it("keeps a manual holiday authoritative when official sync uses the same date", async () => {
    const project = projectFixture();
    const holidays = new FakeHolidayRepository([project]);
    holidays.holidays.push({
      id: "manual-1",
      date: "2026-01-02",
      name: "วันหยุดหน่วยงาน",
      sourceNote: "เพิ่มเอง",
      scope: "NATIONWIDE",
      origin: "MANUAL",
      officialSourceUrl: null,
      officialSourceLabel: null,
      lastConfirmedAt: null,
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const result = await holidays.reconcileOfficialYear(2026, [{
      date: "2026-01-02",
      name: "วันหยุดราชการเพิ่มเป็นกรณีพิเศษ",
      scope: "NATIONWIDE",
      sourceUrl: "https://www.soc.go.th/?p=33672",
      sourceLabel: "สำนักเลขาธิการคณะรัฐมนตรี",
    }], "2026-07-12T00:00:00.000Z");

    expect(result.conflicts).toEqual(["2026-01-02"]);
    expect(holidays.holidays[0].name).toBe("วันหยุดหน่วยงาน");
  });
  it("previews affected projects and confirms a signed holiday change", async () => {
    const project = projectFixture();
    const projects = new FakeProjectRepository(project);
    const holidays = new FakeHolidayRepository([project]);
    const service = new HolidayService(holidays, projects, "test-secret-key");

    const preview = await service.previewMutation({
      operation: "create",
      holiday: {
        date: "2026-07-10",
        name: "วันหยุดพิเศษ",
        sourceNote: "ประกาศทางการ",
      },
    });

    expect(preview.affectedProjects).toEqual([
      { id: "project-1", name: "จัดซื้อระบบ", version: 1 },
    ]);
    const result = await service.confirmMutation(preview.token);
    expect(result.updatedProjectIds).toEqual(["project-1"]);
    expect(projects.project.steps[1].scheduledDate).toBe("2026-07-13");
  });

  it("rejects a tampered preview token", async () => {
    const project = projectFixture();
    const service = new HolidayService(
      new FakeHolidayRepository([project]),
      new FakeProjectRepository(project),
      "test-secret-key",
    );
    await expect(service.confirmMutation("tampered-token")).rejects.toThrow(
      "INVALID_HOLIDAY_PREVIEW_TOKEN",
    );
  });

  it("verifies annual holiday coverage with a source note", async () => {
    const project = projectFixture();
    const service = new HolidayService(
      new FakeHolidayRepository([project]),
      new FakeProjectRepository(project),
      "test-secret-key",
    );
    await expect(service.verifyYear(2026, "มติคณะรัฐมนตรี")).resolves.toMatchObject({
      year: 2026,
      isVerifiedComplete: true,
    });
  });

  it("rejects an empty holiday name before previewing impact", async () => {
    const project = projectFixture();
    const service = new HolidayService(
      new FakeHolidayRepository([project]),
      new FakeProjectRepository(project),
      "test-secret-key",
    );

    await expect(
      service.previewMutation({
        operation: "create",
        holiday: { date: "2026-07-10", name: "", sourceNote: "ประกาศ" },
      }),
    ).rejects.toThrow();
  });
});

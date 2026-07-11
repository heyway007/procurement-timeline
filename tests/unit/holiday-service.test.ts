import { describe, expect, it } from "vitest";
import type {
  HolidayMutation,
  HolidayRecord,
  HolidayRepository,
  YearCoverageRecord,
} from "@/lib/holidays/repository";
import { HolidayService } from "@/lib/holidays/service";
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
      });
    }
  }

  async verifyYear(year: number, sourceNote: string): Promise<YearCoverageRecord> {
    const record = {
      year,
      isVerifiedComplete: true,
      sourceNote,
      verifiedAt: "2026-07-12T00:00:00.000Z",
    };
    this.coverage.push(record);
    return record;
  }
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

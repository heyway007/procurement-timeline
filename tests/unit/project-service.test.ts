import { describe, expect, it } from "vitest";
import type {
  HolidayCalendarReader,
  ProjectMutationResult,
  ProjectRepository,
} from "@/lib/projects/repository";
import { ProjectService } from "@/lib/projects/service";
import type {
  ListProjectsFilter,
  NewProjectRecord,
  ProjectRecord,
  ProjectReplacement,
} from "@/lib/projects/types";

class InMemoryProjectRepository implements ProjectRepository {
  readonly items = new Map<string, ProjectRecord>();
  private sequence = 0;

  async list(filter: ListProjectsFilter): Promise<ProjectRecord[]> {
    const query = filter.query?.toLocaleLowerCase("th") ?? "";
    return [...this.items.values()].filter((project) => {
      const matchesQuery =
        !query ||
        project.name.toLocaleLowerCase("th").includes(query) ||
        project.ownerName.toLocaleLowerCase("th").includes(query);
      const overlapsFrom = !filter.from || project.processEndDate >= filter.from;
      const overlapsTo = !filter.to || project.startDate <= filter.to;
      return matchesQuery && overlapsFrom && overlapsTo;
    });
  }

  async findById(id: string): Promise<ProjectRecord | null> {
    return this.items.get(id) ?? null;
  }

  async create(input: NewProjectRecord): Promise<ProjectRecord> {
    this.sequence += 1;
    const now = "2026-07-12T00:00:00.000Z";
    const project: ProjectRecord = {
      ...input,
      id: `project-${this.sequence}`,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    this.items.set(project.id, project);
    return project;
  }

  async replace(
    id: string,
    expectedVersion: number,
    input: ProjectReplacement,
  ): Promise<ProjectMutationResult> {
    const current = this.items.get(id);
    if (!current) return { kind: "not_found" };
    if (current.version !== expectedVersion) return { kind: "conflict" };
    const project: ProjectRecord = {
      ...input,
      id,
      version: current.version + 1,
      createdAt: current.createdAt,
      updatedAt: "2026-07-12T00:01:00.000Z",
    };
    this.items.set(id, project);
    return { kind: "ok", project };
  }

  async remove(
    id: string,
    expectedVersion: number,
  ): Promise<ProjectMutationResult> {
    const current = this.items.get(id);
    if (!current) return { kind: "not_found" };
    if (current.version !== expectedVersion) return { kind: "conflict" };
    this.items.delete(id);
    return { kind: "ok", project: current };
  }
}

class InMemoryHolidayCalendar implements HolidayCalendarReader {
  constructor(
    private readonly holidays = new Set<string>(),
    private readonly unverifiedYears: number[] = [],
  ) {}

  async listHolidayDates(): Promise<ReadonlySet<string>> {
    return this.holidays;
  }

  async listUnverifiedYears(): Promise<number[]> {
    return this.unverifiedYears;
  }
}

function makeService(
  holidays = new Set<string>(),
): { service: ProjectService; repository: InMemoryProjectRepository } {
  const repository = new InMemoryProjectRepository();
  return {
    repository,
    service: new ProjectService(
      repository,
      new InMemoryHolidayCalendar(holidays),
    ),
  };
}

describe("ProjectService", () => {
  it("rejects a budget category that does not match the actual amount", async () => {
    const { service } = makeService();
    await expect(service.create({ name: "โครงการทดสอบ", ownerName: "ผู้รับผิดชอบ", budget: 6_000_000, budgetCategory: "ONE_TO_FIVE_MILLION", startDate: "2026-07-06", note: "" })).rejects.toThrow();
  });
  it("creates a project with 13 snapshotted milestones", async () => {
    const { service } = makeService();

    const result = await service.create({
      name: "จัดซื้อระบบ",
      ownerName: "คุณสมชาย",
      budget: 29_000_000,
      budgetCategory: "ABOVE_TWENTY_MILLION",
      startDate: "2026-07-06",
      note: "",
    });

    expect(result.project.steps).toHaveLength(13);
    expect(result.project.steps[0].scheduledDate).toBe("2026-07-06");
    expect(result.project.steps[1].scheduledDate).toBe("2026-07-10");
    expect(result.project.templateVersion).toBe(1);
  });

  it("uses a 10-working-day step 6 duration for the 5,000,001-10,000,000 baht category", async () => {
    const { service } = makeService();

    const result = await service.create({
      name: "โครงการช่วงสอง",
      ownerName: "ผู้รับผิดชอบ",
      budget: 6_000_000,
      budgetCategory: "FIVE_TO_TEN_MILLION",
      startDate: "2026-07-06",
      note: "",
    });

    expect(result.project.steps.find((step) => step.order === 6)).toMatchObject({
      workingDaysToNext: 10,
    });
  });

  it("creates the reduced 1,000,000-5,000,000 baht category timeline", async () => {
    const { service } = makeService();

    const result = await service.create({
      name: "โครงการช่วงหนึ่ง",
      ownerName: "ผู้รับผิดชอบ",
      budget: 2_000_000,
      budgetCategory: "ONE_TO_FIVE_MILLION",
      startDate: "2026-07-06",
      note: "",
    });

    expect(result.project.steps).toHaveLength(10);
    expect(result.project.steps.map((step) => step.workingDaysToNext)).toEqual([
      4, 1, 5, 1, 1, 1, 4, 4, 1, 7,
    ]);
    expect(result.project.steps.some((step) => step.label.includes("ประกาศร่าง"))).toBe(false);
    expect(result.project.steps.some((step) => step.label.includes("เผยแพร่ร่าง"))).toBe(false);
  });

  it("rejects a configured holiday as the project start", async () => {
    const { service } = makeService(new Set(["2026-07-28"]));

    await expect(
      service.create({
        name: "จัดซื้อระบบ",
        ownerName: "คุณสมชาย",
        budget: 1_000_000,
        budgetCategory: "ONE_TO_FIVE_MILLION",
        startDate: "2026-07-28",
        note: "",
      }),
    ).rejects.toThrow("START_DATE_MUST_BE_WORKING_DAY");
  });

  it("adjusts a milestone and recalculates all later dates", async () => {
    const { service } = makeService();
    const created = await service.create({
      name: "จัดซื้อระบบ",
      ownerName: "คุณสมชาย",
      budget: 29_000_000,
      budgetCategory: "ABOVE_TWENTY_MILLION",
      startDate: "2026-07-06",
      note: "",
    });

    const changed = await service.adjustStep(created.project.id, {
      order: 2,
      newDate: "2026-07-14",
      version: created.project.version,
      confirmShortening: false,
      confirmOverwrite: false,
    });

    expect(changed.steps[1].scheduledDate).toBe("2026-07-14");
    expect(changed.steps[2].scheduledDate).toBe("2026-07-15");
    expect(changed.version).toBe(2);
  });

  it("rejects stale project versions", async () => {
    const { service } = makeService();
    const created = await service.create({
      name: "จัดซื้อระบบ",
      ownerName: "คุณสมชาย",
      budget: 1_000_000,
      budgetCategory: "ONE_TO_FIVE_MILLION",
      startDate: "2026-07-06",
      note: "",
    });
    await service.resetSchedule(created.project.id, created.project.version);

    await expect(
      service.resetSchedule(created.project.id, created.project.version),
    ).rejects.toThrow("PROJECT_VERSION_CONFLICT");
  });

  it("searches by owner and date overlap", async () => {
    const { service } = makeService();
    await service.create({
      name: "จัดซื้อระบบ",
      ownerName: "คุณสมชาย",
      budget: 1_000_000,
      budgetCategory: "ONE_TO_FIVE_MILLION",
      startDate: "2026-07-06",
      note: "",
    });

    const result = await service.list({
      query: "สมชาย",
      from: "2026-07-01",
      to: "2026-08-31",
    });

    expect(result).toHaveLength(1);
  });

  it("updates project details and recalculates from a new start date", async () => {
    const { service } = makeService();
    const created = await service.create({
      name: "ชื่อเดิม",
      ownerName: "ผู้รับผิดชอบเดิม",
      budget: 1_000_000,
      budgetCategory: "ONE_TO_FIVE_MILLION",
      startDate: "2026-07-06",
      note: "",
    });

    const changed = await service.updateDetails(created.project.id, {
      name: "ชื่อใหม่",
      ownerName: "ผู้รับผิดชอบใหม่",
      budget: 2_000_000,
      budgetCategory: "ONE_TO_FIVE_MILLION",
      startDate: "2026-07-07",
      note: "หมายเหตุใหม่",
      version: created.project.version,
      confirmReset: true,
    });

    expect(changed).toMatchObject({
      name: "ชื่อใหม่",
      ownerName: "ผู้รับผิดชอบใหม่",
      budget: 2_000_000,
      startDate: "2026-07-07",
      version: 2,
    });
    expect(changed.steps.every((step) => !step.isDateManuallyAdjusted)).toBe(
      true,
    );
  });
});

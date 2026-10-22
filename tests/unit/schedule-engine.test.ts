import { describe, expect, it } from "vitest";
import {
  adjustMilestone,
  adjustProcessEnd,
  buildTimeline,
  recalculateWithManualAnchors,
} from "@/lib/schedule/engine";
import type { TemplateStep } from "@/lib/schedule/types";
import { approvedTemplateStepsForBudgetCategory } from "@/lib/schedule/approved-template";

const template: TemplateStep[] = [
  { order: 1, label: "ขั้นตอน 1", workingDaysToNext: 4 },
  { order: 2, label: "ขั้นตอน 2", workingDaysToNext: 1 },
  { order: 3, label: "ขั้นตอน 3", workingDaysToNext: 7 },
];

describe("schedule engine", () => {
  it("uses the project start as milestone one and adds template durations", () => {
    const result = buildTimeline(template, "2026-07-06", new Set());

    expect(result.milestones.map((item) => item.scheduledDate)).toEqual([
      "2026-07-06",
      "2026-07-10",
      "2026-07-13",
    ]);
    expect(result.processEndDate).toBe("2026-07-22");
  });

  it("changes one milestone and recalculates later dates", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    const changed = adjustMilestone(base, 2, "2026-07-14", new Set());

    expect(changed.milestones[0].scheduledDate).toBe("2026-07-06");
    expect(changed.milestones[1]).toMatchObject({
      scheduledDate: "2026-07-14",
      isDateManuallyAdjusted: true,
    });
    expect(changed.milestones[2]).toMatchObject({
      scheduledDate: "2026-07-15",
      isDateManuallyAdjusted: false,
    });
  });

  it("turns a manually adjusted Present milestone into a one-day anchor and recalculates downstream", () => {
    const presentTemplate: TemplateStep[] = [
      { order: 1, label: "ขั้นตอน 1", workingDaysToNext: 4 },
      { order: 2, label: "กำหนดวันเวลาในการ Present (เลือกวันใดวันหนึ่ง)", workingDaysToNext: 3 },
      { order: 3, label: "ขั้นตอนหลัง Present", workingDaysToNext: 4 },
    ];
    const base = buildTimeline(presentTemplate, "2026-07-06", new Set());

    const changed = adjustMilestone(base, 2, "2026-07-14", new Set());

    expect(changed.milestones[1]).toMatchObject({
      scheduledDate: "2026-07-14",
      workingDaysToNext: 1,
      isDateManuallyAdjusted: true,
    });
    expect(changed.milestones[2].scheduledDate).toBe("2026-07-15");
  });

  it("keeps the automatic Present window and following milestone from overlapping across holidays", () => {
    const presentTemplate: TemplateStep[] = [
      { order: 1, label: "ตรวจสอบเอกสารเสนอราคา", workingDaysToNext: 1 },
      { order: 2, label: "กำหนดวันเวลาในการ Present (เลือกวันใดวันหนึ่ง)", workingDaysToNext: 3 },
      { order: 3, label: "คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ", workingDaysToNext: 4 },
    ];
    const holidays = new Set(["2026-07-28", "2026-07-29", "2026-07-30"]);

    const result = buildTimeline(presentTemplate, "2026-07-24", holidays);

    expect(result.milestones.map((step) => step.scheduledDate)).toEqual([
      "2026-07-24",
      "2026-07-27",
      "2026-08-04",
    ]);
  });

  it("keeps the automatic selective-method negotiation window at three working days", () => {
    const result = buildTimeline(
      approvedTemplateStepsForBudgetCategory("SELECTIVE_METHOD"),
      "2026-07-06",
      new Set(),
    );

    expect(result.milestones[8]).toMatchObject({
      scheduledDate: "2026-07-29",
      workingDaysToNext: 3,
      isDateManuallyAdjusted: false,
    });
    expect(result.milestones[9].scheduledDate).toBe("2026-08-03");
  });

  it.each([
    ["2026-07-30", [], "2026-07-31"],
    ["2026-07-31", [], "2026-08-03"],
    ["2026-07-31", ["2026-08-03"], "2026-08-04"],
  ])("uses one selected negotiation day on %s and schedules the next working day", (date, holidayDates, nextDate) => {
    const holidays = new Set(holidayDates);
    const base = buildTimeline(
      approvedTemplateStepsForBudgetCategory("SELECTIVE_METHOD"),
      "2026-07-06",
      holidays,
    );

    const changed = adjustMilestone(base, 9, date, holidays);

    expect(changed.milestones.slice(0, 8)).toEqual(base.milestones.slice(0, 8));
    expect(changed.milestones[8]).toMatchObject({
      scheduledDate: date,
      workingDaysToNext: 1,
      isDateManuallyAdjusted: true,
    });
    expect(changed.milestones[9]).toMatchObject({
      scheduledDate: nextDate,
      isDateManuallyAdjusted: false,
    });
  });

  it.each([
    ["TEN_TO_TWENTY_MILLION", 10],
    ["ONE_TO_FIVE_MILLION", 7],
  ] as const)("preserves the four-day negotiation duration for %s", (category, order) => {
    const base = buildTimeline(
      approvedTemplateStepsForBudgetCategory(category),
      "2026-07-06",
      new Set(),
    );

    const changed = adjustMilestone(base, order, "2026-09-07", new Set());

    expect(changed.milestones[order - 1].workingDaysToNext).toBe(4);
    expect(changed.milestones[order].scheduledDate).toBe("2026-09-11");
  });

  it.each([
    [8, "2026-07-28", "2026-07-29", "2026-08-03"],
    [1, "2026-07-07", "2026-07-30", "2026-08-04"],
  ] as const)("restores the three-day negotiation window when step %s clears its selected day", (order, date, negotiationDate, nextDate) => {
    const base = buildTimeline(
      approvedTemplateStepsForBudgetCategory("SELECTIVE_METHOD"),
      "2026-07-06",
      new Set(),
    );
    const selected = adjustMilestone(base, 9, "2026-07-31", new Set());

    const changed = adjustMilestone(selected, order, date, new Set());

    expect(changed.milestones[8]).toMatchObject({
      scheduledDate: negotiationDate,
      workingDaysToNext: 3,
      isDateManuallyAdjusted: false,
    });
    expect(changed.milestones[9].scheduledDate).toBe(nextDate);
  });

  it("allows the final process end milestone to change", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    const changed = adjustProcessEnd(base, "2026-07-24", new Set());

    expect(changed.processEndDate).toBe("2026-07-24");
    expect(changed.isProcessEndManuallyAdjusted).toBe(true);
  });

  it("rejects a non-working project start", () => {
    expect(() => buildTimeline(template, "2026-07-11", new Set())).toThrow(
      "START_DATE_MUST_BE_WORKING_DAY",
    );
  });

  it("rejects a manual milestone before its predecessor", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    expect(() =>
      adjustMilestone(base, 2, "2026-07-03", new Set()),
    ).toThrow("DATE_MUST_BE_AFTER_PREVIOUS");
  });

  it("recalculates automatic dates while preserving valid manual anchors", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    const anchored = adjustMilestone(base, 3, "2026-07-20", new Set());
    const changed = recalculateWithManualAnchors(
      anchored,
      new Set(["2026-07-10"]),
    );

    expect(changed).toMatchObject({ kind: "ok" });
    if (changed.kind === "ok") {
      expect(changed.timeline.milestones[1].scheduledDate).toBe("2026-07-13");
      expect(changed.timeline.milestones[2].scheduledDate).toBe("2026-07-20");
    }
  });

  it("reports a conflict when a manual anchor becomes a holiday", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    const anchored = adjustMilestone(base, 2, "2026-07-14", new Set());

    expect(
      recalculateWithManualAnchors(anchored, new Set(["2026-07-14"])),
    ).toEqual({ kind: "conflict", order: 2 });
  });
});

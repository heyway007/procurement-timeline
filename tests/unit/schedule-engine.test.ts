import { describe, expect, it } from "vitest";
import {
  adjustMilestone,
  adjustProcessEnd,
  buildTimeline,
  recalculateWithManualAnchors,
} from "@/lib/schedule/engine";
import type { TemplateStep } from "@/lib/schedule/types";

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

import { describe, expect, it } from "vitest";
import { APPROVED_TEMPLATE_STEPS } from "@/lib/schedule/approved-template";

describe("approved procurement template", () => {
  it("contains 13 steps whose outgoing durations total 37", () => {
    expect(APPROVED_TEMPLATE_STEPS).toHaveLength(13);
    expect(
      APPROVED_TEMPLATE_STEPS.reduce(
        (sum, step) => sum + step.workingDaysToNext,
        0,
      ),
    ).toBe(37);
    expect(APPROVED_TEMPLATE_STEPS[0].workingDaysToNext).toBe(4);
    expect(APPROVED_TEMPLATE_STEPS[12].workingDaysToNext).toBe(7);
  });

  it("uses unique sequential order values", () => {
    expect(APPROVED_TEMPLATE_STEPS.map((step) => step.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });
});

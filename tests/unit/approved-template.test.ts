import { describe, expect, it } from "vitest";
import {
  APPROVED_TEMPLATE_STEPS,
  approvedTemplateStepsForBudgetCategory,
} from "@/lib/schedule/approved-template";

describe("approved procurement template", () => {
  it("contains 13 steps whose outgoing durations total 39", () => {
    expect(APPROVED_TEMPLATE_STEPS).toHaveLength(13);
    expect(
      APPROVED_TEMPLATE_STEPS.reduce(
        (sum, step) => sum + step.workingDaysToNext,
        0,
      ),
    ).toBe(39);
    expect(APPROVED_TEMPLATE_STEPS[0].workingDaysToNext).toBe(4);
    expect(APPROVED_TEMPLATE_STEPS[12].workingDaysToNext).toBe(7);
  });

  it("uses unique sequential order values", () => {
    expect(APPROVED_TEMPLATE_STEPS.map((step) => step.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    ]);
  });

  it("does not include the procurement unit prefix in labels", () => {
    expect(
      APPROVED_TEMPLATE_STEPS.every(
        (step) => !step.label.includes("ส่วนงานพัสดุฯ"),
      ),
    ).toBe(true);
  });

  it("uses the reduced 1,000,000-5,000,000 baht timeline from the approved image", () => {
    const steps = approvedTemplateStepsForBudgetCategory("ONE_TO_FIVE_MILLION");

    expect(steps).toHaveLength(10);
    expect(steps.map((step) => step.workingDaysToNext)).toEqual([
      2, 1, 5, 1, 1, 3, 4, 4, 1, 7,
    ]);
    expect(steps.map((step) => step.order)).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
    ]);
    expect(steps[0].label).toBe(
      `${APPROVED_TEMPLATE_STEPS[0].label} + ${APPROVED_TEMPLATE_STEPS[3].label}`,
    );
    expect(steps.some((step) => step.label === APPROVED_TEMPLATE_STEPS[1].label)).toBe(false);
    expect(steps.some((step) => step.label === APPROVED_TEMPLATE_STEPS[2].label)).toBe(false);
    expect(steps[2].label).toBe(APPROVED_TEMPLATE_STEPS[5].label);
    expect(steps[6].label).toBe(APPROVED_TEMPLATE_STEPS[9].label);
  });

  it("defaults the bid submission milestone to the morning time slot", () => {
    expect(APPROVED_TEMPLATE_STEPS[6].bidSubmissionTimeSlot).toBe("MORNING");
    expect(APPROVED_TEMPLATE_STEPS[8].workingDaysToNext).toBe(3);
  });

  it("uses longer document pickup durations for higher budget ranges", () => {
    expect(
      approvedTemplateStepsForBudgetCategory("FIVE_TO_TEN_MILLION")[5].workingDaysToNext,
    ).toBe(8);
    expect(
      approvedTemplateStepsForBudgetCategory("TEN_TO_TWENTY_MILLION")[5].workingDaysToNext,
    ).toBe(10);
    expect(
      approvedTemplateStepsForBudgetCategory("ABOVE_TWENTY_MILLION")[5].workingDaysToNext,
    ).toBe(18);
  });

  it("uses the selective procurement method durations from the approved schedule", () => {
    const steps = approvedTemplateStepsForBudgetCategory("SELECTIVE_METHOD");

    expect(steps).toHaveLength(13);
    expect(steps.map((step) => step.workingDaysToNext)).toEqual([
      2, 2, 2, 1, 5, 1, 2, 2, 3, 1, 2, 1, 7,
    ]);
  });
});

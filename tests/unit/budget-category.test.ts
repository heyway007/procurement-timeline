import { describe, expect, it } from "vitest";
import {
  BUDGET_CATEGORY_OPTIONS,
  budgetCategoryFor,
  budgetCategoryLabel,
  validateBudgetCategory,
} from "@/lib/projects/budget-category";

describe("budget categories", () => {
  it.each([
    [500_001, "ONE_TO_FIVE_MILLION"],
    [1_000_000, "ONE_TO_FIVE_MILLION"],
    [5_000_000, "ONE_TO_FIVE_MILLION"],
    [5_000_001, "FIVE_TO_TEN_MILLION"],
    [10_000_000, "FIVE_TO_TEN_MILLION"],
    [10_000_001, "TEN_TO_TWENTY_MILLION"],
    [50_000_000, "TEN_TO_TWENTY_MILLION"],
    [50_000_001, "ABOVE_TWENTY_MILLION"],
  ] as const)("maps %s to %s", (amount, expected) => {
    expect(budgetCategoryFor(amount)).toBe(expected);
  });

  it("rejects an amount below 500,001 baht", () => {
    expect(() => budgetCategoryFor(500_000.99)).toThrow("BUDGET_BELOW_SUPPORTED_RANGE");
  });

  it("rejects a selected category that does not match the actual amount", () => {
    expect(() => validateBudgetCategory("ONE_TO_FIVE_MILLION", 6_000_000)).toThrow("BUDGET_CATEGORY_MISMATCH");
  });

  it("allows the selective procurement method for any supported budget", () => {
    expect(() => validateBudgetCategory("SELECTIVE_METHOD", 29_000_000)).not.toThrow();
    expect(() => validateBudgetCategory("SPECIFIC_METHOD_UNDER_500K", 500_000)).not.toThrow();
    expect(() => validateBudgetCategory("SPECIFIC_METHOD_OVER_500K", 29_000_000)).not.toThrow();
    expect(budgetCategoryLabel("SELECTIVE_METHOD")).toBe("วิธีคัดเลือก (ทุกวงเงิน)");
    expect(budgetCategoryLabel("SPECIFIC_METHOD_UNDER_500K")).toBe("วิธีเฉพาะเจาะจง / ไม่เกิน 500,000 บาท");
    expect(budgetCategoryLabel("SPECIFIC_METHOD_OVER_500K")).toBe("วิธีเฉพาะเจาะจง / 500,001 บาทขึ้นไป");
  });

  it("uses full numeric labels for every budget range", () => {
    expect(BUDGET_CATEGORY_OPTIONS.map((option) => option.label)).toEqual([
      "e-Bidding / 500,001–5,000,000 บาท",
      "e-Bidding / 5,000,001–10,000,000 บาท",
      "e-Bidding / 10,000,001–50,000,000 บาท",
      "e-Bidding / 50,000,001 บาทขึ้นไป",
      "วิธีคัดเลือก (ทุกวงเงิน)",
      "วิธีเฉพาะเจาะจง / ไม่เกิน 500,000 บาท",
      "วิธีเฉพาะเจาะจง / 500,001 บาทขึ้นไป",
    ]);
    expect(budgetCategoryLabel("FIVE_TO_TEN_MILLION")).toBe(
      "e-Bidding / 5,000,001–10,000,000 บาท",
    );
  });
});

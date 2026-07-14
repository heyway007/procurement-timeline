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

  it("uses full numeric labels for every budget range", () => {
    expect(BUDGET_CATEGORY_OPTIONS.map((option) => option.label)).toEqual([
      "500,001–5,000,000 บาท",
      "5,000,001–10,000,000 บาท",
      "10,000,001–50,000,000 บาท",
      "50,000,001 บาทขึ้นไป",
    ]);
    expect(budgetCategoryLabel("FIVE_TO_TEN_MILLION")).toBe(
      "5,000,001–10,000,000 บาท",
    );
  });
});

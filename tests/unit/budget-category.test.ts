import { describe, expect, it } from "vitest";
import { budgetCategoryFor, validateBudgetCategory } from "@/lib/projects/budget-category";

describe("budget categories", () => {
  it.each([
    [1_000_000, "ONE_TO_FIVE_MILLION"],
    [5_000_000, "ONE_TO_FIVE_MILLION"],
    [5_000_001, "FIVE_TO_TEN_MILLION"],
    [10_000_000, "FIVE_TO_TEN_MILLION"],
    [10_000_001, "TEN_TO_TWENTY_MILLION"],
    [20_000_000, "TEN_TO_TWENTY_MILLION"],
    [20_000_001, "ABOVE_TWENTY_MILLION"],
  ] as const)("maps %s to %s", (amount, expected) => {
    expect(budgetCategoryFor(amount)).toBe(expected);
  });

  it("rejects an amount below one million baht", () => {
    expect(() => budgetCategoryFor(999_999.99)).toThrow("BUDGET_BELOW_SUPPORTED_RANGE");
  });

  it("rejects a selected category that does not match the actual amount", () => {
    expect(() => validateBudgetCategory("ONE_TO_FIVE_MILLION", 6_000_000)).toThrow("BUDGET_CATEGORY_MISMATCH");
  });
});

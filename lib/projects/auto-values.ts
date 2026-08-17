import type { BudgetCategory } from "./budget-category";

const DEFAULT_BUDGETS: Record<BudgetCategory, number> = {
  ONE_TO_FIVE_MILLION: 1_000_000,
  FIVE_TO_TEN_MILLION: 5_000_001,
  TEN_TO_TWENTY_MILLION: 10_000_001,
  ABOVE_TWENTY_MILLION: 50_000_001,
  SELECTIVE_METHOD: 1_000_000,
};

export function defaultBudgetForCategory(category: BudgetCategory): number {
  return DEFAULT_BUDGETS[category];
}

export function generatedProjectName(startDate: string): string {
  const [year, month, day] = startDate.split("-");
  const shortId = globalThis.crypto
    .randomUUID()
    .replaceAll("-", "")
    .slice(0, 8)
    .toUpperCase();
  return `Timeline-${shortId}-${day}${month}${year}`;
}

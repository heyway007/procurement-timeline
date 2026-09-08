import type { BudgetCategory } from "./budget-category";
import { formatProjectName } from "./name";

const DEFAULT_BUDGETS: Record<BudgetCategory, number> = {
  ONE_TO_FIVE_MILLION: 1_000_000,
  FIVE_TO_TEN_MILLION: 5_000_001,
  TEN_TO_TWENTY_MILLION: 10_000_001,
  ABOVE_TWENTY_MILLION: 50_000_001,
  SELECTIVE_METHOD: 1_000_000,
  SPECIFIC_METHOD_UNDER_500K: 500_000,
  SPECIFIC_METHOD_OVER_500K: 500_001,
};

export function defaultBudgetForCategory(category: BudgetCategory): number {
  return DEFAULT_BUDGETS[category];
}

export function generatedProjectName(projects: readonly { name: string }[]): string {
  let highestNumber = projects.length;
  for (const project of projects) {
    const match = /^Timeline #(\d+)$/.exec(project.name);
    if (!match) continue;
    const number = Number(match[1]);
    if (Number.isSafeInteger(number)) {
      highestNumber = Math.max(highestNumber, number);
    }
  }
  return formatProjectName(`Timeline #${highestNumber + 1}`);
}

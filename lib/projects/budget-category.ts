export const BUDGET_CATEGORIES = [
  "ONE_TO_FIVE_MILLION",
  "FIVE_TO_TEN_MILLION",
  "TEN_TO_TWENTY_MILLION",
  "ABOVE_TWENTY_MILLION",
  "SELECTIVE_METHOD",
] as const;

export type BudgetCategory = (typeof BUDGET_CATEGORIES)[number];

export const BUDGET_CATEGORY_OPTIONS: ReadonlyArray<{ value: BudgetCategory; label: string }> = [
  { value: "ONE_TO_FIVE_MILLION", label: "500,001–5,000,000 บาท" },
  { value: "FIVE_TO_TEN_MILLION", label: "5,000,001–10,000,000 บาท" },
  { value: "TEN_TO_TWENTY_MILLION", label: "10,000,001–50,000,000 บาท" },
  { value: "ABOVE_TWENTY_MILLION", label: "50,000,001 บาทขึ้นไป" },
  { value: "SELECTIVE_METHOD", label: "วิธีคัดเลือก" },
];

export function isProcurementMethod(category: BudgetCategory): boolean {
  return category === "SELECTIVE_METHOD";
}

export function budgetCategoryFor(amount: number): BudgetCategory {
  if (!Number.isFinite(amount) || amount < 500_001) throw new Error("BUDGET_BELOW_SUPPORTED_RANGE");
  if (amount <= 5_000_000) return "ONE_TO_FIVE_MILLION";
  if (amount <= 10_000_000) return "FIVE_TO_TEN_MILLION";
  if (amount <= 50_000_000) return "TEN_TO_TWENTY_MILLION";
  return "ABOVE_TWENTY_MILLION";
}

export function validateBudgetCategory(category: BudgetCategory, amount: number): void {
  if (isProcurementMethod(category)) return;
  if (budgetCategoryFor(amount) !== category) throw new Error("BUDGET_CATEGORY_MISMATCH");
}

export function budgetCategoryLabel(category: BudgetCategory): string {
  return BUDGET_CATEGORY_OPTIONS.find((option) => option.value === category)?.label ?? category;
}

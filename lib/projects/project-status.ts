export const PROJECT_STATUS_TYPES = [
  "SLA_COMPLIANT",
  "SLA_NON_COMPLIANT",
] as const;

export type ProjectStatusType = (typeof PROJECT_STATUS_TYPES)[number];

export const PROJECT_STATUS_OPTIONS: ReadonlyArray<{
  value: ProjectStatusType;
  label: string;
}> = [
  { value: "SLA_COMPLIANT", label: "เป็นไปตาม SLA" },
  { value: "SLA_NON_COMPLIANT", label: "ไม่เป็นไปตาม SLA" },
];

export function projectStatusTypeLabel(
  status: ProjectStatusType | undefined,
): string {
  return (
    PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label ??
    PROJECT_STATUS_OPTIONS[0].label
  );
}

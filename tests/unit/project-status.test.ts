import { describe, expect, it } from "vitest";
import {
  PROJECT_STATUS_OPTIONS,
  projectStatusTypeLabel,
} from "@/lib/projects/project-status";

describe("project status types", () => {
  it("offers SLA and non-SLA project status types", () => {
    expect(PROJECT_STATUS_OPTIONS).toEqual([
      { value: "SLA_COMPLIANT", label: "เป็นไปตาม SLA" },
      { value: "SLA_NON_COMPLIANT", label: "ไม่เป็นไปตาม SLA" },
    ]);
    expect(projectStatusTypeLabel("SLA_NON_COMPLIANT")).toBe("ไม่เป็นไปตาม SLA");
  });
});

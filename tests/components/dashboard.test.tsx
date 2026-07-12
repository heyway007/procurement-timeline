import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { Dashboard } from "@/components/dashboard/dashboard";
import type { ProjectRecord } from "@/lib/projects/types";

const projects: ProjectRecord[] = [
  {
    id: "project-1",
    name: "จัดซื้อระบบสารสนเทศ",
    ownerName: "คุณสมชาย",
    budget: 29_000_000,
    budgetCategory: "ABOVE_TWENTY_MILLION",
    startDate: "2026-07-06",
    note: "",
    templateKey: "procurement-29m-v1",
    templateVersion: 1,
    processEndDate: "2026-08-26",
    isProcessEndManuallyAdjusted: false,
    scheduleStatus: "NORMAL",
    version: 1,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    steps: [],
  },
  {
    id: "project-2",
    name: "จัดซื้อครุภัณฑ์",
    ownerName: "คุณสุดา",
    budget: 1_500_000,
    budgetCategory: "ONE_TO_FIVE_MILLION",
    startDate: "2026-09-01",
    note: "",
    templateKey: "procurement-29m-v1",
    templateVersion: 1,
    processEndDate: "2026-10-22",
    isProcessEndManuallyAdjusted: false,
    scheduleStatus: "NORMAL",
    version: 1,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    steps: [],
  },
];

describe("Dashboard", () => {
  it("renders shared projects and Thai formatted values", () => {
    render(<Dashboard initialProjects={projects} />);

    expect(screen.getByText("จัดซื้อระบบสารสนเทศ")).toBeInTheDocument();
    expect(screen.getByText("คุณสมชาย")).toBeInTheDocument();
    expect(screen.getByText(/29,000,000/)).toBeInTheDocument();
    expect(screen.getByText("มากกว่า 20 ล้านบาท")).toBeInTheDocument();
    expect(screen.getAllByText(/2569/)).toHaveLength(4);
  });

  it("filters projects by project name or owner", async () => {
    const user = userEvent.setup();
    render(<Dashboard initialProjects={projects} />);

    await user.type(screen.getByLabelText("ค้นหาโครงการ"), "สุดา");

    expect(screen.getByText("จัดซื้อครุภัณฑ์")).toBeInTheDocument();
    expect(screen.queryByText("จัดซื้อระบบสารสนเทศ")).not.toBeInTheDocument();
  });
});

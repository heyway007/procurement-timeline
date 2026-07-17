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
    budgetCategory: "TEN_TO_TWENTY_MILLION",
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

    expect(screen.getAllByText("จัดซื้อระบบสารสนเทศ")).not.toHaveLength(0);
    expect(screen.getAllByText("คุณสมชาย")).not.toHaveLength(0);
    expect(screen.getAllByText(/29,000,000/)).not.toHaveLength(0);
    expect(screen.getAllByText("10,000,001–50,000,000 บาท")).not.toHaveLength(0);
    expect(screen.getByRole("columnheader", { name: "วันที่เริ่มทำสัญญา" })).toBeInTheDocument();
    expect(screen.getAllByText(/2569/)).toHaveLength(8);
  });

  it("filters projects by project name or owner", async () => {
    const user = userEvent.setup();
    render(<Dashboard initialProjects={projects} />);

    await user.type(screen.getByLabelText("ค้นหาโครงการ"), "สุดา");

    expect(screen.getAllByText("จัดซื้อครุภัณฑ์")).not.toHaveLength(0);
    expect(screen.queryByText("จัดซื้อระบบสารสนเทศ")).not.toBeInTheDocument();
  });

  it("allocates less desktop table width to long project names", () => {
    render(<Dashboard initialProjects={projects} />);

    expect(screen.getByTestId("project-cards")).toHaveClass("xl:hidden");
    expect(screen.getByTestId("desktop-project-table")).toHaveClass("xl:block");

    const table = screen.getByRole("table");
    const projectHeader = screen.getByRole("columnheader", { name: "โครงการ" });
    const actionHeader = screen.getByRole("columnheader", { name: "เปิด" });

    expect(table).toHaveClass("table-fixed", "min-w-[1100px]");
    expect(projectHeader).toHaveClass("w-[41%]");
    expect(actionHeader).toHaveClass("w-[19%]");
    expect(screen.getAllByRole("link", { name: /เปิด Timeline/ })[0]).not.toHaveClass("whitespace-nowrap");
  });
});

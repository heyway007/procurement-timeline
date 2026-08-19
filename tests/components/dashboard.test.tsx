import { render, screen, within } from "@testing-library/react";
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
  it("shows ten projects per page and navigates to the next page", async () => {
    const user = userEvent.setup();
    const pagedProjects = Array.from({ length: 12 }, (_, index) => ({
      ...projects[0],
      id: `project-${index + 1}`,
      name: `โครงการ ${index + 1}`,
    }));

    render(<Dashboard initialProjects={pagedProjects} />);

    const projectCards = screen.getByTestId("project-cards");
    expect(within(projectCards).getAllByRole("article")).toHaveLength(10);
    expect(screen.getByTestId("project-pagination")).toHaveTextContent("หน้า 1 จาก 2");
    expect(screen.getByRole("button", { name: "หน้าถัดไป" })).toBeEnabled();

    await user.click(screen.getByRole("button", { name: "หน้าถัดไป" }));

    expect(within(screen.getByTestId("project-cards")).getAllByRole("article")).toHaveLength(2);
    expect(within(screen.getByTestId("project-cards")).getByText("โครงการ 11")).toBeInTheDocument();
    expect(screen.getByTestId("project-pagination")).toHaveTextContent("หน้า 2 จาก 2");
  });

  it("renders shared projects and Thai formatted values", () => {
    render(<Dashboard initialProjects={projects} />);

    const logo = screen.getByRole("img", { name: "TCEB" });
    expect(logo.getAttribute("src")).toContain("logo-tceb.webp");
    expect(logo.parentElement).toHaveClass("flex", "items-center");
    expect(logo.parentElement).toContainElement(screen.getByRole("heading", { name: "แผนงานจัดซื้อจัดจ้าง" }));
    expect(screen.getAllByText("จัดซื้อระบบสารสนเทศ")).not.toHaveLength(0);
    expect(screen.getAllByText("คุณสมชาย")).not.toHaveLength(0);
    expect(screen.queryByText(/29,000,000/)).not.toBeInTheDocument();
    expect(screen.getAllByText("e-Bidding / 10,000,001–50,000,000 บาท")).not.toHaveLength(0);
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
    const actionHeader = screen.getByRole("columnheader", { name: "จัดการ" });
    const contractHeader = screen.getByRole("columnheader", { name: "วันที่เริ่มทำสัญญา" });

    expect(table).toHaveClass("w-full", "table-fixed", "min-w-[1100px]");
    expect(projectHeader).toHaveClass("w-[41%]");
    expect(actionHeader).toHaveClass("w-[19%]");
    expect(actionHeader).toHaveClass("text-center");
    expect(contractHeader).toHaveClass("whitespace-nowrap");
    expect(screen.getAllByRole("link", { name: /เปิด Timeline/ })[0]).not.toHaveClass("whitespace-nowrap");
  });

  it("keeps the dashboard in normal document flow for vertical scrolling", () => {
    render(<Dashboard initialProjects={projects} />);

    expect(screen.getByRole("main")).toHaveClass("min-h-dvh", "overflow-x-clip", "pb-64");
    expect(screen.getByRole("main")).not.toHaveClass("h-dvh", "overflow-y-auto");
  });

  it("keeps mobile filter fields within the filter card", () => {
    render(<Dashboard initialProjects={projects} />);

    const fromDate = screen.getByLabelText("ช่วงวันที่เริ่ม");
    const toDate = screen.getByLabelText("ถึงวันที่");
    expect(fromDate).toHaveClass("min-w-0", "max-w-full", "text-base", "appearance-none");
    expect(toDate).toHaveClass("min-w-0", "max-w-full", "text-base", "appearance-none");
    expect(fromDate.parentElement).toHaveClass("min-w-0");
    expect(toDate.parentElement).toHaveClass("min-w-0");
  });

  it("uses the TCEB visual language and icon-led dashboard controls", () => {
    render(<Dashboard initialProjects={projects} />);

    expect(screen.getByRole("main")).toHaveClass("tceb-page-shell");
    expect(screen.getByTestId("dashboard-header")).toHaveClass("tceb-hero");
    expect(screen.getByTestId("dashboard-header")).toHaveClass("tceb-hero--flat");
    expect(screen.getByTestId("dashboard-header")).toHaveClass("px-0", "sm:px-0");
    expect(screen.getByRole("region", { name: "ตัวกรองโครงการ" })).toHaveClass("tceb-filter-panel");

    const icons = document.querySelectorAll("svg[data-icon]");
    expect(icons.length).toBeGreaterThanOrEqual(12);
    expect(document.querySelector('svg[data-icon="magnifying-glass"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="calendar-days"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="folder-open"]')).toBeInTheDocument();
    expect(document.querySelector('svg[data-icon="sack-dollar"]')).toBeInTheDocument();
  });
});

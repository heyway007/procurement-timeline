import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Swal from "sweetalert2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TimelineDetail } from "@/components/timeline/timeline-detail";
import {
  APPROVED_TEMPLATE_STEPS,
  approvedTemplateStepsForBudgetCategory,
} from "@/lib/schedule/approved-template";
import { buildTimeline } from "@/lib/schedule/engine";
import type { ProjectRecord } from "@/lib/projects/types";
import { ApiError } from "@/lib/ui/api-client";

vi.mock("sweetalert2", () => ({
  default: {
    fire: vi.fn(),
  },
}));

const swalFire = vi.mocked(Swal.fire);

function projectFixture(): ProjectRecord {
  const timeline = buildTimeline(
    APPROVED_TEMPLATE_STEPS,
    "2026-07-06",
    new Set(),
  );
  return {
    id: "project-1",
    name: "จัดซื้อระบบสารสนเทศ",
    ownerName: "คุณสมชาย",
    departmentName: "ฝ่ายบริหาร",
    budget: 29_000_000,
    budgetCategory: "TEN_TO_TWENTY_MILLION",
    startDate: "2026-07-06",
    note: "ทดสอบ",
    templateKey: "procurement-29m-v1",
    templateVersion: 1,
    processEndDate: timeline.processEndDate,
    isProcessEndManuallyAdjusted: false,
    scheduleStatus: "NORMAL",
    version: 1,
    createdAt: "2026-07-12T00:00:00.000Z",
    updatedAt: "2026-07-12T00:00:00.000Z",
    steps: timeline.milestones,
  };
}

function smallBudgetProjectFixture(): ProjectRecord {
  const timeline = buildTimeline(
    approvedTemplateStepsForBudgetCategory("ONE_TO_FIVE_MILLION"),
    "2026-07-06",
    new Set(),
  );
  return {
    ...projectFixture(),
    budget: 2_000_000,
    budgetCategory: "ONE_TO_FIVE_MILLION",
    processEndDate: timeline.processEndDate,
    steps: timeline.milestones,
  };
}

function selectiveMethodProjectFixture(): ProjectRecord {
  const timeline = buildTimeline(
    approvedTemplateStepsForBudgetCategory("SELECTIVE_METHOD"),
    "2026-07-06",
    new Set(),
  );
  return {
    ...projectFixture(),
    budgetCategory: "SELECTIVE_METHOD",
    processEndDate: timeline.processEndDate,
    steps: timeline.milestones,
  };
}

function smallBudgetProjectWithPresentDate(
  isDateManuallyAdjusted: boolean,
): ProjectRecord {
  return {
    ...smallBudgetProjectFixture(),
    steps: smallBudgetProjectFixture().steps.map((step) =>
      step.order === 6
        ? {
            ...step,
            scheduledDate: "2026-07-27",
            isDateManuallyAdjusted,
            workingDaysToNext: isDateManuallyAdjusted ? 1 : step.workingDaysToNext,
          }
        : step,
    ),
  };
}

describe("TimelineDetail", () => {
  beforeEach(() => {
    swalFire.mockReset();
    swalFire.mockResolvedValue({ isConfirmed: true } as never);
  });

  it("renders all 13 procurement milestones and process end", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getAllByTestId("timeline-step")).toHaveLength(13);
    expect(screen.getAllByText(/39 วันทำการ/)).not.toHaveLength(0);
    expect(screen.getByTestId("print-owner")).not.toHaveClass("print-hidden");
    expect(screen.getByTestId("print-owner")).toHaveTextContent("คุณสมชาย");
    expect(screen.getByTestId("print-department")).toHaveTextContent("ฝ่ายบริหาร");
    const detailActions = screen.getByTestId("timeline-detail-actions");
    const timelineLabel = within(detailActions).getByText("Timeline โครงการ");
    expect(timelineLabel).toBeInTheDocument();
    expect(timelineLabel).toHaveClass("text-lg", "font-bold");
    expect(detailActions.querySelector("svg[data-icon='timeline']")).toBeInTheDocument();
    expect(within(screen.getByTestId("print-header")).queryByText("Timeline โครงการ")).not.toBeInTheDocument();
    expect(screen.getByTestId("print-header").querySelector(".timeline-summary-icon--project")).not.toBeInTheDocument();
    const projectNote = within(screen.getByTestId("print-header")).getByTestId("timeline-project-note");
    const timelineSummary = screen.getByTestId("timeline-summary");
    expect(timelineSummary.compareDocumentPosition(projectNote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const printSummary = screen.getByTestId("print-header").querySelector(".print-summary");
    expect(printSummary).toBeInTheDocument();
    expect(printSummary!.compareDocumentPosition(projectNote) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(projectNote).toHaveTextContent(/หมายเหตุ\s*ทดสอบ/);
    expect(projectNote).not.toHaveClass("print-hidden");
    expect(projectNote).not.toHaveClass("border", "bg-indigo-50/45");
    expect(projectNote).toHaveClass("timeline-summary-stat", "timeline-summary-stat--note");
    expect(projectNote.querySelector(".timeline-summary-stat-icon")).toHaveClass("timeline-project-note-icon", "print-hidden");
    expect(projectNote.querySelector("svg[data-icon='circle-info']")).toBeInTheDocument();
    expect(within(projectNote).getByText("หมายเหตุ")).toHaveClass("block");
    expect(within(projectNote).queryByText("หมายเหตุ :")).not.toBeInTheDocument();
    expect(within(projectNote).getByText("ทดสอบ")).toHaveClass("break-words", "whitespace-pre-wrap");
    const departmentStat = screen.getByTestId("timeline-summary").querySelector(".timeline-summary-stat--department");
    expect(departmentStat?.querySelector(":scope > div")).toHaveClass("min-w-0", "flex-1");
    expect(departmentStat?.querySelector("strong")).toHaveClass("break-words", "whitespace-normal");
    expect(screen.getByTestId("print-budget")).not.toHaveTextContent("29,000,000.00");
    expect(screen.getByTestId("print-budget")).toHaveTextContent("10,000,001–50,000,000 บาท");
    expect(screen.getByTestId("print-total-days")).toHaveTextContent("39 วันทำการ · เป็นไปตาม SLA");
    expect(within(screen.getByTestId("print-header")).queryByText("วันที่เริ่มลงนามในสัญญาได้")).not.toBeInTheDocument();
    expect(screen.getAllByText("วันที่เริ่มลงนามในสัญญาได้")).not.toHaveLength(0);
    expect(screen.queryByText("วันที่เริ่มทำสัญญา")).not.toBeInTheDocument();
    expect(screen.queryByText("วันสิ้นสุดกระบวนการ")).not.toBeInTheDocument();
    expect(screen.getByText("จัดซื้อระบบสารสนเทศ")).toBeInTheDocument();
  });

  it("wraps long project metadata in the print header", () => {
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={{
          ...projectFixture(),
          departmentName: "สำนักส่งเสริมการจัดประชุมและนิทรรศการ ภาคตะวันออกเฉียงเหนือ",
        }}
      />,
    );

    expect(screen.getByRole("heading")).toHaveClass("break-words");
    expect(screen.getByTestId("print-department").querySelector("dd")).toHaveClass(
      "min-w-0",
      "break-words",
      "whitespace-normal",
    );
  });

  it("uses a compact project summary header on small screens", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const header = screen.getByTestId("print-header");
    expect(header).toHaveClass("rounded-2xl", "p-4");
    expect(within(header).getByRole("heading")).toHaveClass("text-xl", "text-center", "sm:text-left");
    expect(within(header).getByRole("heading")).not.toHaveClass("text-2xl");
    expect(header.querySelector(".print-project-department")).not.toBeInTheDocument();
    expect(header.querySelector("dl")).toHaveClass("text-sm");
  });

  it("uses the reference-style detail header and monochrome step icons", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByTestId("timeline-detail-page")).toHaveClass("timeline-detail-page");
    expect(screen.getByTestId("timeline-detail-actions")).toHaveClass("timeline-detail-actions");
    expect(screen.queryByRole("button", { name: "ค้นหาวันถัดไป" })).not.toBeInTheDocument();
    expect(screen.getByTestId("timeline-bottom-actions")).toHaveClass("timeline-bottom-actions");
    expect(within(screen.getByTestId("timeline-bottom-actions")).getByRole("button", { name: "ลบโครงการ" })).toHaveClass("bg-rose-700");
    expect(screen.getByTestId("print-header")).toHaveClass("timeline-summary-header");
    expect(screen.getByTestId("timeline-summary")).toHaveClass("timeline-summary", "print-hidden");
    expect(screen.getByTestId("print-header").querySelector(".print-summary")).toBeInTheDocument();
    expect(screen.getAllByTestId("timeline-step-icon")).toHaveLength(13);
    expect(screen.getAllByTestId("timeline-step-details")).toHaveLength(13);
    expect(screen.getAllByTestId("timeline-step-tooltip")).toHaveLength(13);
    expect(screen.getAllByTestId("timeline-step-tooltip").every((tooltip) => tooltip.hasAttribute("hidden"))).toBe(true);
    expect(screen.getByTestId("timeline-summary").querySelectorAll("svg[data-icon]")).toHaveLength(4);
    expect(screen.getByTestId("timeline-summary")).toHaveClass("lg:grid-cols-[auto_auto_auto_auto]", "lg:justify-between");
    expect(screen.getByTestId("timeline-summary").querySelector(".timeline-summary-stat--department")).toBeInTheDocument();
    expect(screen.getByTestId("timeline-summary")).not.toHaveTextContent("วันที่เริ่มต้น");
    expect(screen.getByTestId("timeline-summary").querySelector(".timeline-summary-stat--status")).toBeInTheDocument();
    const firstStep = screen.getAllByTestId("timeline-step")[0];
    expect(firstStep).toHaveClass("timeline-step", "items-center");
    expect(within(firstStep).getByTestId("timeline-step-order")).toHaveClass("self-center", "text-center");
    expect(within(firstStep).getByTestId("timeline-step-icon")).toHaveClass("h-12", "w-12", "max-[639px]:h-9", "max-[639px]:w-9", "self-center");
    expect(within(firstStep).getByTestId("timeline-step-details")).toHaveClass("timeline-step-details--inline-mobile");
    expect(within(firstStep).getByRole("button", { name: /ดูรายละเอียด/ })).toHaveClass("timeline-step-details-trigger--inline-mobile", "timeline-step-details-trigger--aligned-mobile");
  });

  it("opens step details in a floating dialog from the info icon", async () => {
    const user = userEvent.setup();
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const firstStep = screen.getAllByTestId("timeline-step")[0];
    const trigger = within(firstStep).getByRole("button", { name: /ดูรายละเอียด/ });
    const tooltip = within(firstStep).getByTestId("timeline-step-tooltip");

    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(tooltip).not.toHaveAttribute("hidden");
    expect(within(tooltip).getByText("รายละเอียดขั้นตอน")).toBeInTheDocument();

    await user.click(within(tooltip).getByRole("button", { name: "ปิดรายละเอียด" }));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(tooltip).toHaveAttribute("hidden");
  });

  it("renders step one with a heading and smaller bullet-separated detail", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const firstRow = screen.getAllByTestId("timeline-step")[0];
    const heading = within(firstRow).getByText("จัดทำเอกสาร");
    const detail = within(firstRow).getAllByText(
      "รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา",
    )[0];

    expect(heading).toHaveClass("text-lg", "font-semibold");
    expect(detail).toHaveClass("text-sm", "text-slate-500");
    expect(detail).not.toHaveClass("print-hidden");
  });

  it("renders every large-budget step with the document title and optional subtitle", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const expected = [
      ["จัดทำเอกสาร", "รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา"],
      ["ประกาศร่างประกวดราคาเพื่อรับฟังคำวิจารณ์", "บนเว็บไซต์กรมบัญชีกลาง (e-GP)"],
      ["เผยแพร่ร่างประกวดราคาเพื่อรับฟังคำวิจารณ์"],
      ["จัดทำเอกสาร", "ผลการวิจารณ์ • ประกวดราคา"],
      ["ประกาศประกวดราคา", "บนเว็บไซต์กรมบัญชีกลาง (e-GP)"],
      ["กำหนดขอรับ/ซื้อเอกสาร", "ผู้สนใจสามารถดาวน์โหลดเอกสารจากเว็บไซต์กรมบัญชีกลาง (e-GP)"],
      ["กำหนดวันเสนอราคา (เวลา 9.00 น. - 12.00 น.)", "ยื่นเสนอราคาผ่านเว็บไซต์กรมบัญชีกลาง (e-GP)"],
      ["ตรวจสอบเอกสารเสนอราคา"],
      ["กำหนดวันเวลาในการนำเสนอข้อเทคนิค (Present)", "เลือกวันใดวันหนึ่ง"],
      ["คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ • ต่อรองราคา"],
      ["จัดทำเอกสาร", "รายงานผลพิจารณา • ประกาศผู้ชนะ"],
      ["ประกาศผู้ชนะการเสนอราคา", "บนเว็บไซต์กรมบัญชีกลาง (e-GP)"],
      ["ระยะเวลาอุทธรณ์", "ติดต่อให้ผู้รับจ้างนำส่งเอกสารเพื่อทำสัญญาและวางหลักประกันสัญญา"],
    ] as const;

    screen.getAllByTestId("timeline-step").forEach((row, index) => {
      const [title, subtitle] = expected[index];
      expect(within(row).getByText(title)).toHaveClass("text-lg", "font-semibold");
      if (subtitle) {
        expect(within(row).getAllByText(subtitle)[0]).toHaveClass("text-sm", "text-slate-500");
      }
    });
  });

  it("uses the same document title and subtitle hierarchy for small-budget steps", () => {
    render(<TimelineDetail projectId="project-1" initialProject={smallBudgetProjectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[1]).getByText("ประกาศประกวดราคา")).toHaveClass("text-lg", "font-semibold");
    expect(within(rows[1]).getAllByText("บนเว็บไซต์กรมบัญชีกลาง (e-GP)")[0]).toHaveClass("text-sm", "text-slate-500");
    expect(within(rows[7]).getByText("จัดทำเอกสาร")).toHaveClass("text-lg", "font-semibold");
    expect(within(rows[7]).getAllByText("รายงานผลพิจารณา • ประกาศผู้ชนะ")[0]).toHaveClass("text-sm", "text-slate-500");
  });

  it("renders and immediately saves the bid submission time dropdown", async () => {
    const user = userEvent.setup();
    const onUpdateBidSubmissionTime = vi.fn().mockImplementation(async (slot) => ({
      ...projectFixture(),
      version: 2,
      steps: projectFixture().steps.map((step) =>
        step.order === 7 ? { ...step, bidSubmissionTimeSlot: slot } : step,
      ),
    }));
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onUpdateBidSubmissionTime={onUpdateBidSubmissionTime}
      />,
    );

    const selector = screen.getByRole("combobox", { name: "เวลาเสนอราคา" });
    expect(selector).toHaveValue("MORNING");
    expect(screen.getByText("กำหนดวันเสนอราคา (เวลา 9.00 น. - 12.00 น.)")).toBeInTheDocument();
    expect(screen.getAllByText("ยื่นเสนอราคาผ่านเว็บไซต์กรมบัญชีกลาง (e-GP)")[0]).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบเอกสารเสนอราคา")).toBeInTheDocument();
    expect(screen.queryByText("ตรวจสอบเอกสารเสนอราคา (8.30 น. - 12.00 น.)")).not.toBeInTheDocument();

    await user.selectOptions(selector, "AFTERNOON");

    expect(onUpdateBidSubmissionTime).toHaveBeenCalledWith("AFTERNOON", 1);
    expect(await screen.findByText("กำหนดวันเสนอราคา (เวลา 13.00 น. - 16.30 น.)")).toBeInTheDocument();
  });

  it("hides repeated mobile date labels and the selector when printing", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getAllByText("วันที่กำหนด").slice(1).every((node) => node.classList.contains("print-hidden"))).toBe(true);
    expect(screen.getByRole("combobox", { name: "เวลาเสนอราคา" })).toHaveClass("print-hidden");
  });

  it("shows weekday dates without the calendar preview column", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.queryByText("ปฏิทิน")).not.toBeInTheDocument();
    expect(screen.getAllByText("วันจันทร์ 6 ก.ค. 2569")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: /ดูปฏิทิน/ })).not.toBeInTheDocument();
    expect(screen.queryByTestId("calendar-popover")).not.toBeInTheDocument();
  });

  it("shows date ranges for milestones 3, 6, and the final appeal period", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[2]).getByText("วันจันทร์ 13 ก.ค. 2569 - วันพุธ 15 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[5]).getByText("วันพฤหัสบดี 23 ก.ค. 2569 - วันพุธ 29 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[12]).getByText("วันพุธ 19 ส.ค. 2569 - วันพฤหัสบดี 27 ส.ค. 2569")).toBeInTheDocument();
    expect(within(rows[1]).getByText("วันศุกร์ 10 ก.ค. 2569")).toBeInTheDocument();
  });

  it("counts milestone 3 and 6 ranges forward from their start instead of backward from the next milestone", () => {
    const project = projectFixture();
    project.steps = project.steps.map((step) => {
      if (step.order === 4) {
        return { ...step, scheduledDate: "2026-07-20", isDateManuallyAdjusted: true };
      }
      if (step.order === 7) {
        return { ...step, scheduledDate: "2026-08-03", isDateManuallyAdjusted: true };
      }
      return step;
    });

    render(<TimelineDetail projectId="project-1" initialProject={project} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[2]).getByText("วันจันทร์ 13 ก.ค. 2569 - วันพุธ 15 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[5]).getByText("วันพฤหัสบดี 23 ก.ค. 2569 - วันพุธ 29 ก.ค. 2569")).toBeInTheDocument();
  });

  it("shows small-budget date ranges for document pickup, committee selection, and the final appeal period", () => {
    render(<TimelineDetail projectId="project-1" initialProject={smallBudgetProjectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(rows).toHaveLength(10);
    expect(screen.getAllByText(/29 วันทำการ/)).not.toHaveLength(0);
    expect(within(rows[2]).getByText("วันพฤหัสบดี 9 ก.ค. 2569 - วันพุธ 15 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[6]).getByText("วันพฤหัสบดี 23 ก.ค. 2569 - วันอังคาร 28 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[9]).getByText("วันพุธ 5 ส.ค. 2569 - วันพฤหัสบดี 13 ส.ค. 2569")).toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent(" - ");
    expect(rows[7]).not.toHaveTextContent(" - ");
  });

  it("shows date ranges for selective method offer period, document review, and Present", () => {
    render(<TimelineDetail projectId="project-1" initialProject={selectiveMethodProjectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(rows).toHaveLength(13);
    expect(rows[4]).toHaveTextContent(" - ");
    expect(rows[6]).toHaveTextContent(" - ");
    expect(rows[7]).toHaveTextContent(" - ");
    expect(rows[8]).toHaveTextContent(" - ");
    expect(rows[5]).not.toHaveTextContent(" - ");
  });

  it("splits selective method steps into titles and subtitles without plus signs", () => {
    render(<TimelineDetail projectId="project-1" initialProject={selectiveMethodProjectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[0]).getByText("จัดทำเอกสาร")).toBeInTheDocument();
    expect(within(rows[0]).getAllByText("รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ")[0]).toBeInTheDocument();
    expect(within(rows[7]).getByText("กำหนดวันเวลาในการนำเสนอข้อเทคนิค (Present)")).toHaveClass("text-lg", "font-semibold");
    expect(within(rows[7]).getAllByText("เลือกวันใดวันหนึ่ง")[0]).toBeInTheDocument();
    const negotiationTitle = within(rows[8]).getByText("คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ • ต่อรองราคา");
    expect(negotiationTitle).toHaveClass("text-lg", "font-semibold");
    expect(within(rows[8]).queryByText("ต่อรองราคา", { exact: true })).not.toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it("shows the automatic Present milestone as three working days after the previous milestone", () => {
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={smallBudgetProjectFixture()}
      />,
    );

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[5]).getByText("วันจันทร์ 20 ก.ค. 2569 - วันพุธ 22 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[5]).getAllByText("3 วันทำการจากขั้นตอนก่อนหน้า")[0]).toBeInTheDocument();
  });

  it("shows a manually adjusted Present milestone as a single working day", () => {
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={smallBudgetProjectWithPresentDate(true)}
      />,
    );

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[5]).getByText("วันจันทร์ 27 ก.ค. 2569")).toBeInTheDocument();
    expect(rows[5]).not.toHaveTextContent(" - ");
    expect(within(rows[5]).getAllByText(/1 วันทำการถึงขั้นตอนถัดไป/)[0]).toBeInTheDocument();
  });

  it("marks timeline rows for print table layout", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByTestId("timeline-table")).toHaveClass("print-table");
    expect(screen.getByTestId("timeline-header-row")).toHaveClass("print-grid");
    expect(screen.getAllByTestId("timeline-step")[0]).toHaveClass("print-grid");
    expect(screen.getAllByText("ขั้นตอนที่")[0]).toHaveClass("print-hidden");
  });

  it("keeps the timeline table as five columns on small screens", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByTestId("timeline-header-row")).toHaveClass("grid");
    expect(screen.getByTestId("timeline-header-row")).not.toHaveClass("hidden");
    expect(screen.getAllByTestId("timeline-step")[0]).toHaveClass(
      "grid-cols-[1.75rem_3rem_minmax(0,1fr)_minmax(0,1.15fr)_3.5rem]",
    );
  });

  it("keeps mobile edit-date buttons compact and vertically centered", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const buttons = screen.getAllByRole("button", { name: /แก้วันที่ ขั้นตอนที่/ });
    expect(buttons[0]).toHaveClass("timeline-step-edit-button", "max-[639px]:h-14", "max-[639px]:min-h-14", "max-[639px]:w-max", "max-[639px]:justify-self-end", "self-center");
    expect(buttons[1]).toHaveClass("timeline-step-edit-button", "max-[639px]:h-14", "max-[639px]:min-h-14", "max-[639px]:w-max", "max-[639px]:justify-self-end", "self-center");
  });

  it("keeps the document as the mobile scroll container", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByRole("main")).toHaveClass("overflow-x-clip", "pb-32");
    expect(screen.getByRole("main")).not.toHaveClass("overflow-x-hidden");
  });

  it("renders the project back link in the detail action bar", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const backLink = screen.getByRole("link", { name: /กลับหน้าโครงการ/ });

    expect(backLink).toHaveClass(
      "inline-flex",
      "items-center",
      "gap-2",
      "rounded-lg",
      "border",
      "border-slate-200",
      "bg-white",
      "text-slate-700",
    );
    expect(backLink.querySelector('svg[data-icon="arrow-left"]')).toBeInTheDocument();
    expect(backLink.parentElement).toHaveClass("timeline-detail-actions", "justify-between");
  });

  it("marks a shortened manually adjusted timeline as not meeting SLA", () => {
    const shortened = {
      ...projectFixture(),
      steps: projectFixture().steps.map((step, index) =>
        index === 0
          ? { ...step, workingDaysToNext: 1, isDateManuallyAdjusted: true }
          : step,
      ),
    };

    render(<TimelineDetail projectId="project-1" initialProject={shortened} />);

    expect(screen.getByTestId("print-total-days")).toHaveTextContent(
      "36 วันทำการ · ไม่เป็นไปตาม SLA",
    );
  });

  it("hides the procurement unit prefix from existing timeline labels", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.queryByText(/ส่วนงานพัสดุฯ/)).not.toBeInTheDocument();
  });

  it("shows the choose-one-day note for automatic Present milestone labels", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByText("กำหนดวันเวลาในการนำเสนอข้อเทคนิค (Present)")).toBeInTheDocument();
    expect(screen.getAllByText("เลือกวันใดวันหนึ่ง")[0]).toBeInTheDocument();
  });

  it("hides the choose-one-day note after the Present milestone is manually adjusted", () => {
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={{
          ...projectFixture(),
          steps: projectFixture().steps.map((step) =>
            step.label.includes("Present")
              ? { ...step, isDateManuallyAdjusted: true }
              : step,
          ),
        }}
      />,
    );

    expect(screen.getByText("กำหนดวันเวลาในการนำเสนอข้อเทคนิค (Present)")).toBeInTheDocument();
    expect(screen.queryByText(/เลือกวันใดวันหนึ่ง/)).not.toBeInTheDocument();
  });

  it("submits a manual date edit immediately, shows success, and then closes the editor", async () => {
    const user = userEvent.setup();
    const onAdjustStep = vi.fn().mockResolvedValue(projectFixture());
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onAdjustStep={onAdjustStep}
      />,
    );

    await user.click(screen.getByRole("button", { name: "แก้วันที่ ขั้นตอนที่ 2" }));
    expect(screen.getByLabelText("วันที่ใหม่")).toHaveClass("min-w-0", "max-w-full", "text-base", "appearance-none");
    expect(screen.getByRole("button", { name: "ตกลง" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ยืนยันการแก้วันที่" })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("วันที่ใหม่"));
    await user.type(screen.getByLabelText("วันที่ใหม่"), "2026-07-14");
    await user.click(screen.getByRole("button", { name: "ตกลง" }));

    expect(swalFire).not.toHaveBeenCalledWith(
      expect.objectContaining({ icon: "question" }),
    );
    expect(onAdjustStep).toHaveBeenCalledWith(2, "2026-07-14", 1, false, false);
    expect(swalFire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "แก้วันที่สำเร็จ",
      }),
    );
    expect(screen.queryByRole("heading", { name: "แก้วันที่ขั้นตอนที่ 2" })).not.toBeInTheDocument();
  });

  it("submits a manual date edit without a confirmation dialog", async () => {
    const user = userEvent.setup();
    const onAdjustStep = vi.fn().mockResolvedValue(projectFixture());
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onAdjustStep={onAdjustStep}
      />,
    );

    await user.click(screen.getByRole("button", { name: "แก้วันที่ ขั้นตอนที่ 2" }));
    await user.clear(screen.getByLabelText("วันที่ใหม่"));
    await user.type(screen.getByLabelText("วันที่ใหม่"), "2026-07-14");
    await user.click(screen.getByRole("button", { name: "ตกลง" }));

    expect(onAdjustStep).toHaveBeenCalledWith(2, "2026-07-14", 1, false, false);
    expect(swalFire).toHaveBeenLastCalledWith(
      expect.objectContaining({ icon: "success" }),
    );
  });

  it("closes the date editor before waiting for a confirmed overwrite save", async () => {
    const user = userEvent.setup();
    let resolveAdjust!: (project: ProjectRecord) => void;
    const pendingAdjust = new Promise<ProjectRecord>((resolve) => {
      resolveAdjust = resolve;
    });
    const onAdjustStep = vi
      .fn()
      .mockRejectedValueOnce(
        new ApiError(
          "DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED",
          "วันที่ซึ่งเคยปรับในขั้นตอนหลังจะถูกคำนวณใหม่",
          422,
        ),
      )
      .mockReturnValueOnce(pendingAdjust);

    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onAdjustStep={onAdjustStep}
      />,
    );

    await user.click(screen.getByRole("button", { name: "แก้วันที่ ขั้นตอนที่ 2" }));
    await user.clear(screen.getByLabelText("วันที่ใหม่"));
    await user.type(screen.getByLabelText("วันที่ใหม่"), "2026-07-14");
    await user.click(screen.getByRole("button", { name: "ตกลง" }));

    await waitFor(() => {
      expect(swalFire).toHaveBeenCalledWith(
        expect.objectContaining({ title: "ยืนยันการเขียนทับวันที่ถัดไป?" }),
      );
      expect(onAdjustStep).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("heading", { name: "แก้วันที่ขั้นตอนที่ 2" })).not.toBeInTheDocument();
    expect(onAdjustStep).toHaveBeenLastCalledWith(2, "2026-07-14", 1, false, true);

    resolveAdjust(projectFixture());
    await waitFor(() => {
      expect(swalFire).toHaveBeenLastCalledWith(
        expect.objectContaining({ icon: "success", title: "แก้วันที่สำเร็จ" }),
      );
    });
  });

  it("explains why a date before the previous milestone cannot be selected before submitting", async () => {
    const user = userEvent.setup();
    const onAdjustStep = vi.fn().mockResolvedValue(projectFixture());
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onAdjustStep={onAdjustStep}
      />,
    );

    await user.click(screen.getByRole("button", { name: "แก้วันที่ ขั้นตอนที่ 9" }));
    await user.clear(screen.getByLabelText("วันที่ใหม่"));
    await user.type(screen.getByLabelText("วันที่ใหม่"), "2026-07-30");
    await user.click(screen.getByRole("button", { name: "ตกลง" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "เลือกไม่ได้ เพราะวันที่ใหม่ต้องอยู่หลังขั้นตอนที่ 8",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("วันศุกร์ 31 ก.ค. 2569");
    expect(onAdjustStep).not.toHaveBeenCalled();
  });

  it("resets the schedule with SweetAlert confirmation and success instead of window.confirm", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    const onResetSchedule = vi.fn().mockResolvedValue(projectFixture());
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onResetSchedule={onResetSchedule}
      />,
    );

    await user.click(screen.getByRole("button", { name: "คืนค่าเริ่มต้น" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "question",
        title: "คืนค่าตามแม่แบบ?",
      }),
    );
    expect(onResetSchedule).toHaveBeenCalledWith(1);
    expect(swalFire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "คืนค่าสำเร็จ",
      }),
    );
  });

  it("deletes the project with SweetAlert confirmation and success instead of window.confirm", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm");
    const onDeleteProject = vi.fn().mockResolvedValue(undefined);
    const onNavigateHome = vi.fn();
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={projectFixture()}
        onDeleteProject={onDeleteProject}
        onNavigateHome={onNavigateHome}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ลบโครงการ" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "warning",
        title: "ลบโครงการ?",
      }),
    );
    expect(onDeleteProject).toHaveBeenCalledWith(1);
    expect(swalFire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "ลบโครงการสำเร็จ",
      }),
    );
    expect(onNavigateHome).toHaveBeenCalledOnce();
  });

  it("prints the timeline", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    await user.click(screen.getByRole("button", { name: "พิมพ์ Timeline" }));
    expect(print).toHaveBeenCalledOnce();
  });
});

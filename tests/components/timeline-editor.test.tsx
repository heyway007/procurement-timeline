import { render, screen, within } from "@testing-library/react";
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
    expect(screen.getByText(/39 วันทำการ/)).toBeInTheDocument();
    expect(screen.getByTestId("print-owner")).not.toHaveClass("print-hidden");
    expect(screen.getByTestId("print-owner")).toHaveTextContent("คุณสมชาย");
    expect(screen.getByTestId("print-department")).toHaveTextContent("ฝ่ายบริหาร");
    expect(screen.getByTestId("print-total-days")).toHaveTextContent("39 วันทำการ · เป็นไปตาม SLA");
    expect(within(screen.getByTestId("print-header")).queryByText("วันที่เริ่มทำสัญญา")).not.toBeInTheDocument();
    expect(screen.getAllByText("วันที่เริ่มทำสัญญา")).not.toHaveLength(0);
    expect(screen.queryByText("วันสิ้นสุดกระบวนการ")).not.toBeInTheDocument();
    expect(screen.getByText("จัดซื้อระบบสารสนเทศ")).toBeInTheDocument();
  });

  it("renders step one with a heading and smaller bullet-separated detail", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const firstRow = screen.getAllByTestId("timeline-step")[0];
    const heading = within(firstRow).getByText("จัดทำเอกสาร");
    const detail = within(firstRow).getByText(
      "รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา",
    );

    expect(heading).toHaveClass("text-lg", "font-semibold");
    expect(detail).toHaveClass("text-sm", "text-slate-500");
    expect(detail).not.toHaveClass("print-hidden");
  });

  it("does not replace the wording of later steps", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const secondRow = screen.getAllByTestId("timeline-step")[1];
    expect(secondRow).toHaveTextContent(
      "ประกาศร่างประกาศและเอกสารประกวดราคาเพื่อรับฟังคำวิจารณ์",
    );
    expect(within(secondRow).queryByText("จัดทำเอกสาร")).not.toBeInTheDocument();
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
    expect(screen.getByText("กำหนดวันเสนอราคา (ตั้งแต่เวลา 8.30 น. - 12.00 น.)")).toBeInTheDocument();
    expect(screen.getByText("ผู้ยื่นใบเสนอราคาผ่านเว็บไซต์ของกรมบัญชีกลางเท่านั้น")).toBeInTheDocument();
    expect(screen.getByText("ตรวจสอบเอกสารเสนอราคา")).toBeInTheDocument();
    expect(screen.queryByText("ตรวจสอบเอกสารเสนอราคา (8.30 น. - 12.00 น.)")).not.toBeInTheDocument();

    await user.selectOptions(selector, "AFTERNOON");

    expect(onUpdateBidSubmissionTime).toHaveBeenCalledWith("AFTERNOON", 1);
    expect(await screen.findByText("กำหนดวันเสนอราคา (ตั้งแต่เวลา 13.30 น. - 16.30 น.)")).toBeInTheDocument();
  });

  it("hides repeated mobile date labels and the selector when printing", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getAllByText("วันที่กำหนด").slice(1).every((node) => node.classList.contains("print-hidden"))).toBe(true);
    expect(screen.getByRole("combobox", { name: "เวลาเสนอราคา" })).toHaveClass("print-hidden");
  });

  it("shows weekday dates without the calendar preview column", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.queryByText("ปฏิทิน")).not.toBeInTheDocument();
    expect(screen.getByText("วันจันทร์ 6 ก.ค. 2569")).toBeInTheDocument();
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
    expect(screen.getByText(/31 วันทำการ/)).toBeInTheDocument();
    expect(within(rows[2]).getByText("วันจันทร์ 13 ก.ค. 2569 - วันศุกร์ 17 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[6]).getByText("วันจันทร์ 27 ก.ค. 2569 - วันพฤหัสบดี 30 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[9]).getByText("วันศุกร์ 7 ส.ค. 2569 - วันจันทร์ 17 ส.ค. 2569")).toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent(" - ");
    expect(rows[7]).not.toHaveTextContent(" - ");
  });

  it("shows the automatic Present milestone as three working days after the previous milestone", () => {
    render(
      <TimelineDetail
        projectId="project-1"
        initialProject={smallBudgetProjectFixture()}
      />,
    );

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[5]).getByText("วันพุธ 22 ก.ค. 2569 - วันศุกร์ 24 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[5]).getByText("3 วันทำการจากขั้นตอนก่อนหน้า")).toBeInTheDocument();
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
    expect(within(rows[5]).getByText(/1 วันทำการถึงขั้นตอนถัดไป/)).toBeInTheDocument();
  });

  it("marks timeline rows for print table layout", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByTestId("timeline-table")).toHaveClass("print-table");
    expect(screen.getByTestId("timeline-header-row")).toHaveClass("print-grid");
    expect(screen.getAllByTestId("timeline-step")[0]).toHaveClass("print-grid");
    expect(screen.getAllByText("ขั้นตอนที่")[0]).toHaveClass("print-hidden");
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

    expect(screen.getByText("กำหนดวันเวลาในการ Present (เลือกวันใดวันหนึ่ง)")).toBeInTheDocument();
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

    expect(screen.getByText("กำหนดวันเวลาในการ Present")).toBeInTheDocument();
    expect(screen.queryByText(/เลือกวันใดวันหนึ่ง/)).not.toBeInTheDocument();
  });

  it("submits a manual date edit after confirmation, shows success, and then closes the editor", async () => {
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
    expect(screen.getByRole("button", { name: "ตกลง" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "ยืนยันการแก้วันที่" })).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("วันที่ใหม่"));
    await user.type(screen.getByLabelText("วันที่ใหม่"), "2026-07-14");
    await user.click(screen.getByRole("button", { name: "ตกลง" }));

    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "question",
        showCancelButton: true,
      }),
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

  it("does not submit a manual date edit when the SweetAlert confirmation is cancelled", async () => {
    const user = userEvent.setup();
    const onAdjustStep = vi.fn().mockResolvedValue(projectFixture());
    swalFire.mockResolvedValueOnce({ isConfirmed: false } as never);
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

    expect(swalFire).toHaveBeenCalledOnce();
    expect(onAdjustStep).not.toHaveBeenCalled();
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

    await user.click(screen.getByRole("button", { name: "คืนค่าตามแม่แบบ" }));

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

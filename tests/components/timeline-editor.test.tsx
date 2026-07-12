import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimelineDetail } from "@/components/timeline/timeline-detail";
import {
  APPROVED_TEMPLATE_STEPS,
  approvedTemplateStepsForBudgetCategory,
} from "@/lib/schedule/approved-template";
import { buildTimeline } from "@/lib/schedule/engine";
import type { ProjectRecord } from "@/lib/projects/types";

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
    budget: 29_000_000,
    budgetCategory: "ABOVE_TWENTY_MILLION",
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

describe("TimelineDetail", () => {
  it("renders all 13 procurement milestones and process end", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getAllByTestId("timeline-step")).toHaveLength(13);
    expect(screen.getByText("37 วันทำการ")).toBeInTheDocument();
    expect(screen.getByTestId("print-owner")).toHaveClass("print-hidden");
    expect(screen.getAllByText("วันที่เริ่มทำสัญญา")).not.toHaveLength(0);
    expect(screen.queryByText("วันสิ้นสุดกระบวนการ")).not.toBeInTheDocument();
    expect(screen.getByText("จัดซื้อระบบสารสนเทศ")).toBeInTheDocument();
  });

  it("shows weekday dates and a focusable calendar preview", async () => {
    const user = userEvent.setup();
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByText("ปฏิทิน")).toBeInTheDocument();
    expect(screen.getByText("วันจันทร์ 6 ก.ค. 2569")).toBeInTheDocument();

    const firstCalendar = screen.getByRole("button", {
      name: "ดูปฏิทิน วันจันทร์ 6 กรกฎาคม 2569",
    });
    await user.click(firstCalendar);

    expect(screen.getByText("กรกฎาคม 2569")).toBeInTheDocument();
    expect(screen.getByText("วันจันทร์ 6 กรกฎาคม 2569")).toBeInTheDocument();
    expect(screen.getByLabelText("วันที่เลือก 6")).toBeInTheDocument();
  });

  it("opens late milestone calendar previews upward", async () => {
    const user = userEvent.setup();
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const calendarButtons = screen.getAllByRole("button", { name: /ปฏิทิน/ });
    await user.click(calendarButtons[11]);

    expect(screen.getByTestId("calendar-popover")).toHaveClass("bottom-11");
    expect(screen.getByTestId("calendar-popover")).not.toHaveClass("top-11");
  });

  it("shows date ranges for milestones 3 and 6 only", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(within(rows[2]).getByText("วันจันทร์ 13 ก.ค. 2569 - วันพุธ 15 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[5]).getByText("วันพฤหัสบดี 23 ก.ค. 2569 - วันพุธ 29 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[1]).getByText("วันศุกร์ 10 ก.ค. 2569")).toBeInTheDocument();
  });

  it("shows small-budget date ranges for document pickup and committee selection", () => {
    render(<TimelineDetail projectId="project-1" initialProject={smallBudgetProjectFixture()} />);

    const rows = screen.getAllByTestId("timeline-step");
    expect(rows).toHaveLength(10);
    expect(screen.getByText("29 วันทำการ")).toBeInTheDocument();
    expect(within(rows[2]).getByText("วันจันทร์ 13 ก.ค. 2569 - วันศุกร์ 17 ก.ค. 2569")).toBeInTheDocument();
    expect(within(rows[6]).getByText("วันพฤหัสบดี 23 ก.ค. 2569 - วันอังคาร 28 ก.ค. 2569")).toBeInTheDocument();
    expect(rows[1]).not.toHaveTextContent(" - ");
    expect(rows[7]).not.toHaveTextContent(" - ");
  });

  it("marks timeline rows for print table layout", () => {
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    expect(screen.getByTestId("timeline-table")).toHaveClass("print-table");
    expect(screen.getByTestId("timeline-header-row")).toHaveClass("print-grid");
    expect(screen.getAllByTestId("timeline-step")[0]).toHaveClass("print-grid");
  });

  it("submits a manual date edit for the selected milestone", async () => {
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
    await user.click(screen.getByRole("button", { name: "ยืนยันการแก้วันที่" }));

    expect(onAdjustStep).toHaveBeenCalledWith(2, "2026-07-14", 1, false, false);
  });

  it("prints the timeline", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => undefined);
    render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

    await user.click(screen.getByRole("button", { name: "พิมพ์ Timeline" }));
    expect(print).toHaveBeenCalledOnce();
  });
});

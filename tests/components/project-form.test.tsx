import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/dashboard/project-form";

describe("ProjectForm", () => {
  it("submits the required project information", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ id: "project-1" });
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("ชื่อโครงการ"), "จัดซื้อระบบ");
    await user.type(screen.getByLabelText("ผู้รับผิดชอบ"), "คุณสมชาย");
    await user.type(screen.getByLabelText("วงเงิน (บาท)"), "29000000");
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-06");
    await user.type(screen.getByLabelText("หมายเหตุ"), "โครงการทดสอบ");
    await user.click(screen.getByRole("button", { name: "บันทึก Timeline" }));

    expect(onCreate).toHaveBeenCalledWith({
      name: "จัดซื้อระบบ",
      ownerName: "คุณสมชาย",
      budget: 29_000_000,
      startDate: "2026-07-06",
      note: "โครงการทดสอบ",
    });
  });

  it("shows a warning and does not submit a weekend start", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);

    await user.type(screen.getByLabelText("ชื่อโครงการ"), "จัดซื้อระบบ");
    await user.type(screen.getByLabelText("ผู้รับผิดชอบ"), "คุณสมชาย");
    await user.type(screen.getByLabelText("วงเงิน (บาท)"), "1");
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-11");
    await user.click(screen.getByRole("button", { name: "บันทึก Timeline" }));

    expect(
      screen.getByText("วันที่เริ่มต้นต้องไม่เป็นวันเสาร์หรือวันอาทิตย์"),
    ).toBeInTheDocument();
    expect(onCreate).not.toHaveBeenCalled();
  });
});

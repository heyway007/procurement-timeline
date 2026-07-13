import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Swal from "sweetalert2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/dashboard/project-form";

vi.mock("sweetalert2", () => ({
  default: {
    fire: vi.fn(),
  },
}));

const swalFire = vi.mocked(Swal.fire);

async function fillBase(user: ReturnType<typeof userEvent.setup>, budget = "29000000") {
  await user.type(screen.getByLabelText("ชื่อโครงการ"), "จัดซื้อระบบ");
  await user.type(screen.getByLabelText("ผู้จัดทำ Timeline"), "คุณสมชาย");
  await user.selectOptions(screen.getByLabelText("ฝ่าย"), "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ");
  await user.selectOptions(screen.getByLabelText("ประเภทวงเงิน"), "TEN_TO_TWENTY_MILLION");
  await user.type(screen.getByLabelText("วงเงินจัดจ้าง (บาท)"), budget);
}

describe("ProjectForm", () => {
  beforeEach(() => {
    swalFire.mockReset();
    swalFire.mockResolvedValue({ isConfirmed: true } as never);
  });

  it("places the owner field below the start date field", () => {
    render(<ProjectForm onCancel={() => undefined} onCreate={vi.fn()} />);

    const form = screen.getByLabelText("ชื่อโครงการ").closest("form");
    expect(form).not.toBeNull();
    const controls = Array.from(
      form?.querySelectorAll("input, select, textarea") ?? [],
    ).map((element) => element.getAttribute("name"));

    expect(controls.indexOf("ownerName")).toBeGreaterThan(
      controls.indexOf("startDate"),
    );
  });

  it("submits category and actual budget", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ id: "project-1" });
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);
    await fillBase(user);
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-06");
    await user.type(screen.getByLabelText("หมายเหตุ"), "โครงการทดสอบ");
    await user.click(screen.getByRole("button", { name: "บันทึก Timeline" }));
    expect(onCreate).toHaveBeenCalledWith({ name: "จัดซื้อระบบ", ownerName: "คุณสมชาย", departmentName: "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ", budget: 29_000_000, budgetCategory: "TEN_TO_TWENTY_MILLION", startDate: "2026-07-06", note: "โครงการทดสอบ" });
    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "บันทึก Timeline สำเร็จ",
      }),
    );
  });

  it("blocks submission when category does not match the actual budget", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);
    await fillBase(user, "5000000");
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-06");
    await user.click(screen.getByRole("button", { name: "บันทึก Timeline" }));
    expect(screen.getByRole("alert")).toHaveTextContent("ประเภทวงเงินไม่ตรงกับวงเงินจริง");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("shows a warning and does not submit a weekend start", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);
    await fillBase(user);
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-11");
    await user.click(screen.getByRole("button", { name: "บันทึก Timeline" }));
    expect(screen.getByRole("alert")).toHaveTextContent("วันที่เริ่มต้นต้องไม่เป็นวันเสาร์หรือวันอาทิตย์");
    expect(onCreate).not.toHaveBeenCalled();
  });
});

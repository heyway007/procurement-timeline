import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Swal from "sweetalert2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectForm } from "@/components/dashboard/project-form";

const routerPush = vi.hoisted(() => vi.fn());

vi.mock("sweetalert2", () => ({
  default: {
    fire: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: routerPush }),
}));

const swalFire = vi.mocked(Swal.fire);

async function fillBase(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(screen.getByLabelText("ฝ่าย"), "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ");
  await user.selectOptions(screen.getByLabelText("ประเภทวงเงิน / วิธี"), "TEN_TO_TWENTY_MILLION");
}

describe("ProjectForm", () => {
  beforeEach(() => {
    swalFire.mockReset();
    swalFire.mockResolvedValue({ isConfirmed: true } as never);
    routerPush.mockReset();
  });

  it("keeps project name and owner fields optional while hiding budget", () => {
    render(<ProjectForm onCancel={() => undefined} onCreate={vi.fn()} />);

    const dialog = screen.getByRole("dialog");
    expect(dialog.parentElement).toHaveClass("overflow-y-auto");
    expect(dialog).toHaveClass("min-h-0", "h-[calc(100dvh-1rem)]", "max-h-[calc(100dvh-1rem)]");
    expect(dialog.firstElementChild).toHaveClass("min-h-0", "flex-1", "overflow-y-auto");
    expect(screen.getByLabelText("ชื่อโครงการ")).toBeInTheDocument();
    expect(screen.getByLabelText("วันที่เริ่มต้น")).toHaveClass("min-w-0", "max-w-full");
    expect(screen.getByLabelText("ชื่อโครงการ")).not.toBeRequired();
    expect(screen.getByLabelText("ผู้จัดทำ Timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("ผู้จัดทำ Timeline")).not.toBeRequired();
    expect(screen.queryByLabelText("วงเงินจัดจ้าง (บาท)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ฝ่าย")).not.toBeRequired();
    expect(screen.getByLabelText("ประเภทวงเงิน / วิธี")).toBeInTheDocument();
    expect(screen.getByLabelText("ประเภทวงเงิน / วิธี")).toBeRequired();
    expect(screen.getByRole("option", { name: "เลือกประเภทวงเงิน / วิธี" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "วิธีคัดเลือก" })).toBeInTheDocument();
    expect(screen.getByText("/ วิธี")).not.toHaveClass("text-rose-600");
  });

  it("submits without project name, owner, or budget inputs", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ id: "project-1" });
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);
    await fillBase(user);
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-06");
    await user.type(screen.getByLabelText("หมายเหตุ"), "โครงการทดสอบ");
    await user.click(screen.getByRole("button", { name: "สร้าง Timeline" }));
    expect(onCreate).toHaveBeenCalledWith({ name: "", ownerName: "", departmentName: "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ", budgetCategory: "TEN_TO_TWENTY_MILLION", startDate: "2026-07-06", note: "โครงการทดสอบ" });
    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "สร้าง Timeline สำเร็จ",
      }),
    );
    expect(routerPush).toHaveBeenCalledWith("/projects/project-1");
  });

  it("shows a warning and does not submit a weekend start", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn();
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);
    await fillBase(user);
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-11");
    await user.click(screen.getByRole("button", { name: "สร้าง Timeline" }));
    expect(screen.getByRole("alert")).toHaveTextContent("วันที่เริ่มต้นต้องไม่เป็นวันเสาร์หรือวันอาทิตย์");
    expect(onCreate).not.toHaveBeenCalled();
  });
});

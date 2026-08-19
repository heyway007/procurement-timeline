import { fireEvent, render, screen } from "@testing-library/react";
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
  await user.selectOptions(screen.getByLabelText("สถานะโครงการ"), "SLA_COMPLIANT");
  await user.selectOptions(screen.getByLabelText("ฝ่าย"), "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ");
  await user.selectOptions(screen.getByLabelText("วิธี / วงเงิน"), "TEN_TO_TWENTY_MILLION");
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
    expect(screen.getByLabelText("วันที่เริ่มต้น")).toHaveClass("min-w-0", "max-w-full", "text-base", "appearance-none");
    expect(screen.getByLabelText("ชื่อโครงการ")).not.toBeRequired();
    expect(screen.getByLabelText("ผู้จัดทำ Timeline")).toBeInTheDocument();
    expect(screen.getByLabelText("ผู้จัดทำ Timeline")).not.toBeRequired();
    expect(screen.queryByLabelText("วงเงินจัดจ้าง (บาท)")).not.toBeInTheDocument();
    expect(screen.getByLabelText("ฝ่าย")).not.toBeRequired();
    expect(screen.getByLabelText("สถานะโครงการ")).toBeRequired();
    expect(screen.getByRole("option", { name: "เป็นไปตาม SLA" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "ไม่เป็นไปตาม SLA" })).toBeInTheDocument();
    expect(screen.getByLabelText("วิธี / วงเงิน")).toBeInTheDocument();
    expect(screen.getByLabelText("วิธี / วงเงิน")).toBeRequired();
    expect(screen.getByRole("option", { name: "เลือกวิธี / วงเงิน" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "e-Bidding / 500,001–5,000,000 บาท" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "วิธีคัดเลือก (ทุกวงเงิน)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "วิธีเฉพาะเจาะจง / ไม่เกิน 500,000 บาท" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "วิธีเฉพาะเจาะจง / 500,001 บาทขึ้นไป" })).toBeInTheDocument();
  });

  it("submits without project name, owner, or budget inputs", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ id: "project-1" });
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);
    await fillBase(user);
    await user.type(screen.getByLabelText("วันที่เริ่มต้น"), "2026-07-06");
    await user.type(screen.getByLabelText("หมายเหตุ"), "โครงการทดสอบ");
    await user.click(screen.getByRole("button", { name: "สร้าง Timeline" }));
    expect(onCreate).toHaveBeenCalledWith({ name: "", ownerName: "", departmentName: "ฝ่ายส่งเสริมการจัดประชุมนานาชาติ", projectStatusType: "SLA_COMPLIANT", budgetCategory: "TEN_TO_TWENTY_MILLION", startDate: "2026-07-06", note: "โครงการทดสอบ" });
    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "สร้าง Timeline สำเร็จ",
      }),
    );
    expect(routerPush).toHaveBeenCalledWith("/projects/project-1");
  });

  it("passes the entered project name to the create handler", async () => {
    const user = userEvent.setup();
    const onCreate = vi.fn().mockResolvedValue({ id: "project-2" });
    render(<ProjectForm onCancel={() => undefined} onCreate={onCreate} />);

    const nameInput = document.querySelector<HTMLInputElement>('input[name="name"]');
    expect(nameInput).not.toBeNull();
    await user.type(nameInput!, "Named project");
    await fillBase(user);
    const startDateInput = document.querySelector<HTMLInputElement>('input[name="startDate"]');
    expect(startDateInput).not.toBeNull();
    await user.type(startDateInput!, "2026-07-06");
    await user.click(screen.getByRole("button", { name: /Timeline/ }));

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ name: "Named project" }));
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

  it("uses a Thai validation message for each required field", () => {
    render(<ProjectForm onCancel={() => undefined} onCreate={vi.fn()} />);

    const department = screen.getByLabelText("ฝ่าย");
    const status = screen.getByLabelText("สถานะโครงการ");
    const budgetCategory = screen.getByLabelText("วิธี / วงเงิน");
    const startDate = screen.getByLabelText("วันที่เริ่มต้น");

    fireEvent.invalid(department);
    fireEvent.invalid(status);
    fireEvent.invalid(budgetCategory);
    fireEvent.invalid(startDate);

    expect(department).toHaveProperty("validationMessage", "กรุณาเลือกฝ่าย");
    expect(status).toHaveProperty("validationMessage", "กรุณาเลือกสถานะโครงการ");
    expect(budgetCategory).toHaveProperty("validationMessage", "กรุณาเลือกวิธี / วงเงิน");
    expect(startDate).toHaveProperty("validationMessage", "กรุณาเลือกวันที่เริ่มต้น");
  });

  it("warns when selecting a non-SLA project status", async () => {
    const user = userEvent.setup();
    render(<ProjectForm onCancel={() => undefined} onCreate={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("สถานะโครงการ"), "SLA_NON_COMPLIANT");

    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "แจ้งเตือน",
        text: "ผอ.ฝ่ายฯ จะต้องส่งอีเมลหาผอ.ฝ่ายบริหาร เพื่อขอดำเนินการไม่เป็นไปตาม SLA",
        icon: "warning",
      }),
    );
  });
});

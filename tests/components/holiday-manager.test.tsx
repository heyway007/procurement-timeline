import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Swal from "sweetalert2";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { HolidayManager } from "@/components/holidays/holiday-manager";
import type { HolidayRecord } from "@/lib/holidays/repository";

vi.mock("sweetalert2", () => ({
  default: {
    fire: vi.fn(),
  },
}));

const swalFire = vi.mocked(Swal.fire);
const plannedHoliday: HolidayRecord = {
  id: "planned-2027-01-01", date: "2027-01-01", name: "วันขึ้นปีใหม่",
  sourceNote: "ปฏิทินล่วงหน้าเพื่อวางแผน", scope: "NATIONWIDE", origin: "PLANNED",
  officialSourceUrl: null, officialSourceLabel: null, lastConfirmedAt: null,
  createdAt: "2026-11-26T00:00:00.000Z", updatedAt: "2026-11-26T00:00:00.000Z",
};

describe("HolidayManager", () => {
  beforeEach(() => {
    swalFire.mockReset();
    swalFire.mockResolvedValue({ isConfirmed: true } as never);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
    );
  });

  it("renders the project back link with the shared timeline button style", () => {
    render(<HolidayManager initialYear={2026} initialHolidays={[]} />);

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
    const backIcon = backLink.querySelector('svg[data-icon="arrow-left"]');
    expect(backIcon).toBeInTheDocument();
    expect(backIcon).toHaveClass("h-4", "w-4", "shrink-0");
  });

  it("keeps the page heading and back action in one responsive header", () => {
    render(<HolidayManager initialYear={2026} initialHolidays={[]} />);

    const heading = screen.getByRole("heading", { name: "จัดการวันหยุดราชการ" });
    const header = heading.closest("header");

    expect(header).toHaveClass("sm:items-center", "sm:justify-between");
    expect(screen.getByRole("link", { name: /กลับหน้าโครงการ/ }).parentElement).toBe(header);
  });

  it("aligns the year control and sync status from the same top edge", () => {
    render(<HolidayManager initialYear={2026} initialHolidays={[]} />);

    const yearInput = screen.getByRole("spinbutton", { name: "ปี ค.ศ." });
    const controls = yearInput.closest("section");
    const addButton = screen.getByRole("button", { name: "เพิ่มวันหยุด" });

    expect(controls).toHaveClass("md:items-start", "md:grid-cols-[12rem_minmax(0,1fr)_auto]");
    expect(addButton).toHaveClass("md:col-start-3");
    expect(addButton).toHaveClass("inline-flex", "items-center", "justify-center", "gap-2");
    expect(addButton.querySelector('svg[data-icon="calendar-plus"]')).toBeInTheDocument();
    expect(addButton.parentElement).toBe(controls);
  });

  it("shows holidays and previews a new holiday before confirming", async () => {
    const user = userEvent.setup();
    const previewMutation = vi.fn().mockResolvedValue({
      token: "signed-token",
      affectedProjects: [{ id: "p1", name: "จัดซื้อระบบ", version: 1 }],
    });
    render(
      <HolidayManager
        initialYear={2026}
        initialHolidays={[
          {
            id: "h1",
            date: "2026-07-28",
            name: "วันเฉลิมพระชนมพรรษา",
            sourceNote: "ประกาศทางการ",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-01-01T00:00:00.000Z",
            scope: "BANGKOK",
            origin: "OFFICIAL_SYNC",
            officialSourceUrl: "https://www.soc.go.th/?p=33672",
            officialSourceLabel: "สำนักเลขาธิการคณะรัฐมนตรี",
            lastConfirmedAt: "2026-01-01T00:00:00.000Z",
          },
        ]}
        previewMutation={previewMutation}
      />,
    );

    expect(screen.getByText("วันเฉลิมพระชนมพรรษา")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "เพิ่มวันหยุด" }));
    await user.type(screen.getByLabelText("วันที่หยุด"), "2026-10-16");
    await user.type(screen.getByLabelText("ชื่อวันหยุด"), "วันหยุดพิเศษ");
    await user.type(screen.getByLabelText("แหล่งอ้างอิง"), "มติคณะรัฐมนตรี");
    await user.click(screen.getByRole("button", { name: "ตรวจสอบผลกระทบ" }));

    expect(screen.getByText("กรุงเทพมหานคร")).toBeInTheDocument();
    expect(screen.getByText("ราชการ")).toBeInTheDocument();
    expect(previewMutation).toHaveBeenCalledWith({
      operation: "create",
      holiday: {
        date: "2026-10-16",
        name: "วันหยุดพิเศษ",
        sourceNote: "มติคณะรัฐมนตรี",
      },
    });
    expect(screen.getByText(/จัดซื้อระบบ/)).toBeInTheDocument();
  });

  it("shows the global impact count while listing only the returned own projects", async () => {
    const user = userEvent.setup();
    const previewMutation = vi.fn().mockResolvedValue({
      token: "signed-token",
      affectedProjectCount: 8,
      affectedProjects: [{ id: "own-project", name: "โครงการของฉัน", version: 1 }],
    });
    render(<HolidayManager initialYear={2026} initialHolidays={[]} previewMutation={previewMutation} />);
    await user.click(screen.getByRole("button", { name: "เพิ่มวันหยุด" }));
    await user.type(screen.getByLabelText("วันที่หยุด"), "2026-10-16");
    await user.type(screen.getByLabelText("ชื่อวันหยุด"), "วันหยุดพิเศษ");
    await user.type(screen.getByLabelText("แหล่งอ้างอิง"), "มติคณะรัฐมนตรี");
    await user.click(screen.getByRole("button", { name: "ตรวจสอบผลกระทบ" }));
    expect(screen.getByText("โครงการที่อาจถูกคำนวณใหม่ 8 รายการ")).toBeInTheDocument();
    expect(screen.getByText("แสดงรายชื่อ Timeline ที่ได้รับผลกระทบ")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("listitem")).toHaveTextContent("โครงการของฉัน");
  });

  it("confirms and saves a holiday with SweetAlert confirmation and success", async () => {
    const user = userEvent.setup();
    const previewMutation = vi.fn().mockResolvedValue({
      token: "signed-token",
      affectedProjects: [{ id: "p1", name: "จัดซื้อระบบ", version: 1 }],
    });
    render(
      <HolidayManager
        initialYear={2026}
        initialHolidays={[]}
        previewMutation={previewMutation}
      />,
    );

    await user.click(screen.getByRole("button", { name: "เพิ่มวันหยุด" }));
    await user.type(screen.getByLabelText("วันที่หยุด"), "2026-10-16");
    await user.type(screen.getByLabelText("ชื่อวันหยุด"), "วันหยุดพิเศษ");
    await user.type(screen.getByLabelText("แหล่งอ้างอิง"), "มติคณะรัฐมนตรี");
    await user.click(screen.getByRole("button", { name: "ตรวจสอบผลกระทบ" }));
    await user.click(screen.getByRole("button", { name: "ยืนยันและคำนวณใหม่" }));

    expect(swalFire).toHaveBeenCalledWith(
      expect.objectContaining({
        icon: "question",
        title: "ยืนยันการบันทึกวันหยุด?",
      }),
    );
    expect(fetch).toHaveBeenCalledWith(
      "/api/holidays/confirm",
      expect.objectContaining({ method: "POST" }),
    );
    expect(swalFire).toHaveBeenLastCalledWith(
      expect.objectContaining({
        icon: "success",
        title: "บันทึกวันหยุดสำเร็จ",
      }),
    );
  });

  it("identifies advance dates without claiming they are cached official holidays", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({
      holidays: [plannedHoliday],
      sync: { status: "CACHED", cached: true, message: null, sourceUrl: null, lastSuccessfulSyncAt: null },
    }) } as Response);
    render(<HolidayManager initialYear={2027} readOnly />);

    expect(await screen.findByText("วันขึ้นปีใหม่")).toBeInTheDocument();
    expect(screen.getByText("ล่วงหน้า")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("2027");
    expect(screen.getByRole("status")).toHaveTextContent("วันพืชมงคล");
    expect(screen.queryByText("กำลังใช้ข้อมูลราชการที่บันทึกไว้")).not.toBeInTheDocument();
    expect(screen.queryByText("เพิ่มเอง")).not.toBeInTheDocument();
  });

  it("loads a future year from the shortcuts even when the initial year was supplied", async () => {
    const user = userEvent.setup();
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({
      holidays: [plannedHoliday],
      sync: { status: "CACHED", cached: true, message: null, sourceUrl: null, lastSuccessfulSyncAt: null },
    }) } as Response);
    render(<HolidayManager initialYear={2026} initialHolidays={[]} readOnly />);

    await user.click(screen.getByRole("button", { name: "2027 (พ.ศ. 2570)" }));
    expect(await screen.findByText("วันขึ้นปีใหม่")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "ปี ค.ศ." })).toHaveValue(2027);
    expect(screen.getByRole("button", { name: "2028 (พ.ศ. 2571)" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "2026 (พ.ศ. 2569)" }));
    expect(screen.queryByText("วันขึ้นปีใหม่")).not.toBeInTheDocument();
  });

  it("keeps advance dates visible and explains a failed automatic publication check", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: true, json: async () => ({
      holidays: [plannedHoliday],
      sync: { status: "CACHED", cached: true, message: "OFFICIAL_SOURCE_UNAVAILABLE", sourceUrl: null, lastSuccessfulSyncAt: null },
    }) } as Response);
    render(<HolidayManager initialYear={2027} readOnly />);

    expect(await screen.findByText(/ยังตรวจประกาศราชการล่าสุดไม่ได้/)).toBeInTheDocument();
    expect(screen.getByText("วันขึ้นปีใหม่")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("ลองใหม่อัตโนมัติ");
  });

  it("replaces a projected row immediately when a manual holiday is saved on its date", async () => {
    const user = userEvent.setup();
    const previewMutation = vi.fn().mockResolvedValue({ token: "signed-token", affectedProjects: [] });
    render(<HolidayManager initialYear={2027} initialHolidays={[plannedHoliday]} previewMutation={previewMutation} />);

    await user.click(screen.getByRole("button", { name: "เพิ่มวันหยุด" }));
    await user.type(screen.getByLabelText("วันที่หยุด"), "2027-01-01");
    await user.type(screen.getByLabelText("ชื่อวันหยุด"), "วันหยุดหน่วยงาน");
    await user.type(screen.getByLabelText("แหล่งอ้างอิง"), "ประกาศหน่วยงาน");
    await user.click(screen.getByRole("button", { name: "ตรวจสอบผลกระทบ" }));
    await user.click(screen.getByRole("button", { name: "ยืนยันและคำนวณใหม่" }));

    expect(screen.getByText("วันหยุดหน่วยงาน")).toBeInTheDocument();
    expect(screen.queryByText("วันขึ้นปีใหม่")).not.toBeInTheDocument();
    expect(screen.queryByText("ล่วงหน้า")).not.toBeInTheDocument();
  });
});

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { HolidayManager } from "@/components/holidays/holiday-manager";

describe("HolidayManager", () => {
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
});

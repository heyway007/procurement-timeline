import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import HomePage from "@/app/page";
import RootLayout from "@/app/layout";

const router = vi.hoisted(() => ({ replace: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
afterEach(() => vi.unstubAllGlobals());

describe("application shell", () => {
  it("uses the full-width site container for the page background treatment", () => {
    const layout = RootLayout({ children: <div /> });
    const body = layout.props.children;

    expect(body.type).toBe("body");
    expect(body.props.className).toBe("tceb-full-container tceb-full-container--soft");
  });

  it("renders the Thai product title and create action without a login or session check", async () => {
    const requests: string[] = [];
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async (url: string) => {
      requests.push(url);
      const body = url === "/api/auth/me"
        ? { user: { id: "user-1", email: "person@example.com", displayName: "ผู้ใช้งานทดสอบ", role: "USER" } }
        : { projects: [] };
      return new Response(JSON.stringify(body), { headers: { "Content-Type": "application/json" } });
    }));
    render(<HomePage />);

    expect(
      await screen.findByRole("heading", { name: "แผนงานจัดซื้อจัดจ้าง" }),
    ).toBeInTheDocument();
    expect(requests).toEqual(["/api/projects?"]);
    expect(screen.queryByRole("button", { name: "ออกจากระบบ" })).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "สร้าง Timeline" }),
    ).toBeInTheDocument();
  });
});

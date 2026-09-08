import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticatedShell } from "@/components/auth/authenticated-shell";
import { LoginForm, safeReturnTo } from "@/components/auth/login-form";
import { ProjectForm } from "@/components/dashboard/project-form";
import { Dashboard } from "@/components/dashboard/dashboard";
import { HolidayManager } from "@/components/holidays/holiday-manager";
import { getProjects } from "@/lib/ui/api-client";

const { replace, router } = vi.hoisted(() => { const replace = vi.fn(); return { replace, router: { replace, push: vi.fn() } }; });
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sweetalert2", () => ({ default: { fire: vi.fn().mockResolvedValue({ isConfirmed: true }) } }));

const sessionUser = { id: "user-1", email: "person@example.com", displayName: "ผู้ใช้งานทดสอบ", role: "USER" };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("authentication UI", () => {
  beforeEach(() => { replace.mockReset(); window.history.replaceState({}, "", "/"); });
  afterEach(() => vi.unstubAllGlobals());

  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "/%2f%2fevil.example", "/foo/..//evil.example", "/%2e%2e//evil.example", "javascript:alert(1)", "/login", "/login?returnTo=/login"])("rejects unsafe return location %s", (path) => {
    expect(safeReturnTo(path)).toBe("/");
  });

  it("preserves a local project route", () => {
    expect(safeReturnTo("/projects/project-1?view=calendar")).toBe("/projects/project-1?view=calendar");
  });

  it("shows a failed login without navigating or retaining the password", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ message: "อีเมลหรือรหัสผ่านไม่ถูกต้อง" }, 401)));
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("อีเมล"), "person@example.com");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "test-password");
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
    expect(screen.getByLabelText("รหัสผ่าน")).toHaveValue("");
    expect(replace).not.toHaveBeenCalled();
  });

  it("submits credentials and navigates to a safe requested page", async () => {
    window.history.replaceState({}, "", "/login?returnTo=%2Fprojects%2Fproject-1");
    const fetchMock = vi.fn().mockResolvedValue(json({ user: sessionUser }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("อีเมล"), "person@example.com");
    await user.type(screen.getByLabelText("รหัสผ่าน"), "test-password");
    await user.click(screen.getByRole("button", { name: "เข้าสู่ระบบ" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/projects/project-1"));
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/login", expect.objectContaining({ method: "POST", body: JSON.stringify({ email: "person@example.com", password: "test-password" }) }));
  });

  it("keeps project data unmounted until the session has been checked", async () => {
    let resolveSession!: (value: Response) => void;
    vi.stubGlobal("fetch", vi.fn().mockImplementation(() => new Promise<Response>((resolve) => { resolveSession = resolve; })));
    render(<AuthenticatedShell><p>Private project content</p></AuthenticatedShell>);
    expect(screen.queryByText("Private project content")).not.toBeInTheDocument();
    await act(async () => resolveSession(json({ user: sessionUser })));
    expect(await screen.findByText("Private project content")).toBeInTheDocument();
    expect(screen.getByText(sessionUser.displayName)).toBeInTheDocument();
  });

  it("redirects unauthenticated visits while preserving their local destination", async () => {
    window.history.replaceState({}, "", "/projects/project-1");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({}, 401)));
    render(<AuthenticatedShell><p>Private project content</p></AuthenticatedShell>);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login?returnTo=%2Fprojects%2Fproject-1"));
    expect(screen.queryByText("Private project content")).not.toBeInTheDocument();
  });

  it("unmounts protected data and returns to login when an API request expires", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ user: sessionUser })).mockResolvedValueOnce(new Response("expired", { status: 401 })));
    render(<AuthenticatedShell><p>Private project content</p></AuthenticatedShell>);
    await screen.findByText("Private project content");
    await act(async () => { await expect(getProjects()).rejects.toMatchObject({ status: 401 }); });
    expect(screen.queryByText("Private project content")).not.toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/login?returnTo=%2F");
  });

  it("logs out through the server before removing the authenticated content", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ user: sessionUser })).mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthenticatedShell><p>Private project content</p></AuthenticatedShell>);
    await screen.findByText("Private project content");
    await userEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/auth/logout", expect.objectContaining({ method: "POST" }));
    expect(screen.queryByText("Private project content")).not.toBeInTheDocument();
  });

  it("keeps the session visible when logout fails and enables retry", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(json({ user: sessionUser })).mockRejectedValueOnce(new Error("offline")));
    render(<AuthenticatedShell><p>Private project content</p></AuthenticatedShell>);
    await screen.findByText("Private project content");
    await userEvent.click(screen.getByRole("button", { name: "ออกจากระบบ" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Private project content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "ออกจากระบบ" })).toBeEnabled();
    expect(replace).not.toHaveBeenCalled();
  });

  it("uses the authenticated owner even if a form value is tampered with", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ user: sessionUser })));
    const onCreate = vi.fn().mockResolvedValue({ id: "created" });
    render(<AuthenticatedShell><ProjectForm onCancel={vi.fn()} onCreate={onCreate} /></AuthenticatedShell>);
    const owner = await screen.findByLabelText("ผู้จัดทำ Timeline");
    expect(owner).toHaveValue(sessionUser.displayName);
    expect(owner).toHaveAttribute("readonly");
    fireEvent.change(owner, { target: { value: "Forged owner" } });
    fireEvent.change(screen.getByLabelText("วันที่เริ่มต้น"), { target: { value: "2026-07-06" } });
    fireEvent.submit(owner.closest("form")!);
    await waitFor(() => expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ ownerName: sessionUser.displayName })));
  });

  it("hides holiday management from regular users and keeps the calendar read-only", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json({ user: sessionUser })));
    render(<AuthenticatedShell><Dashboard initialProjects={[]} /><HolidayManager initialHolidays={[]} /></AuthenticatedShell>);
    await screen.findByText(sessionUser.displayName);
    expect(screen.queryByRole("link", { name: "จัดการวันหยุด" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "เพิ่มวันหยุด" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "อัปเดตวันหยุดราชการ" })).not.toBeInTheDocument();
  });

  it("allows admins to explicitly refresh the official holiday calendar", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json({ user: { ...sessionUser, role: "ADMIN" } })).mockResolvedValueOnce(json({ holidays: [], sync: { status: "FRESH", cached: false, message: null, sourceUrl: null, lastSuccessfulSyncAt: null } }));
    vi.stubGlobal("fetch", fetchMock);
    render(<AuthenticatedShell><HolidayManager initialYear={2026} initialHolidays={[]} /></AuthenticatedShell>);
    await userEvent.click(await screen.findByRole("button", { name: "อัปเดตวันหยุดราชการ" }));
    expect(await screen.findByText("ข้อมูลวันหยุดราชการเป็นปัจจุบัน")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenLastCalledWith("/api/holidays", expect.objectContaining({ method: "POST", body: JSON.stringify({ year: 2026 }) }));
  });
});

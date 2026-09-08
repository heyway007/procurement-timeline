// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthError } from "@/lib/auth/errors";

const state = vi.hoisted(() => ({ login: vi.fn(), logout: vi.fn(), requireUser: vi.fn(), token: "a".repeat(64) }));
vi.mock("@/lib/auth/server", () => ({ getAuthService: () => ({ login: state.login, logout: state.logout }), requireUser: state.requireUser }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => ({ value: state.token }) }) }));
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
const user = { id: "local-1", email: "one@example.com", displayName: "One", role: "USER" };
const request = (body: unknown, origin = "https://timeline.example") => new Request("https://timeline.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", origin }, body: JSON.stringify(body) });

describe("authentication HTTP routes", () => {
  beforeEach(() => { vi.resetAllMocks(); });
  it("issues an HttpOnly cookie and exposes only the user, never the token", async () => {
    state.login.mockResolvedValue({ user, token: state.token, expiresAt: new Date() });
    const response = await login(request({ email: user.email, password: "password" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ user });
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    expect(response.headers.get("set-cookie")).toContain("SameSite=lax");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("rejects foreign origins, malformed bodies, and oversized credentials", async () => {
    expect((await login(request({ email: user.email, password: "password" }, "https://evil.example"))).status).toBe(403);
    expect((await login(request({ email: user.email }))).status).toBe(401);
    expect((await login(request({ email: user.email, password: "x".repeat(4096) }))).status).toBe(401);
    expect(state.login).not.toHaveBeenCalled();
  });
  it("does not echo database or provider error details", async () => {
    state.login.mockRejectedValue(new Error("database password=secret"));
    const response = await login(request({ email: user.email, password: "password" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "AUTH_UNAVAILABLE" });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
  it("stops reading an oversized request body before buffering the rest", async () => {
    let cancelled = false;
    let reads = 0;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) { reads++; if (reads <= 3) controller.enqueue(new TextEncoder().encode("x".repeat(5000))); else controller.close(); },
      cancel() { cancelled = true; },
    });
    const input = new Request("https://timeline.example/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json", origin: "https://timeline.example" }, body, duplex: "half",
    } as RequestInit);
    expect((await login(input)).status).toBe(401);
    expect(cancelled).toBe(true);
    expect(state.login).not.toHaveBeenCalled();
  });
  it("returns noncacheable session state and a 401 after session loss", async () => {
    state.requireUser.mockResolvedValueOnce(user).mockRejectedValueOnce(new AuthError("UNAUTHENTICATED", 401));
    const response = await me();
    expect(await response.json()).toEqual({ user });
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    const expired = await me();
    expect(expired.status).toBe(401);
    expect(expired.headers.get("Cache-Control")).toContain("no-store");
  });
  it("revokes the presented token and clears its cookie on logout", async () => {
    const response = await logout(request({}));
    expect(response.status).toBe(200);
    expect(state.logout).toHaveBeenCalledWith(state.token);
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
    expect(response.headers.get("Cache-Control")).toContain("no-store");
  });
});

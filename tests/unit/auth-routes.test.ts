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
  it("disables login without issuing a session or contacting the provider", async () => {
    const response = await login();
    expect(response.status).toBe(410);
    expect(await response.json()).toEqual({ error: "LOGIN_DISABLED" });
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("Cache-Control")).toContain("no-store");
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

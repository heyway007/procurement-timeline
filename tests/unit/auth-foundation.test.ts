// @vitest-environment node
import { describe, expect, it } from "vitest";
import { hashMockPassword } from "@/lib/auth/password";
import { createAuthProvider } from "@/lib/auth/provider";
import { AuthService, type AuthRepository, type StoredUser, type StoredSession } from "@/lib/auth/service";
import { assertSameOrigin, authErrorResponse, sessionCookieOptions } from "@/lib/auth/http";

const identity = { provider: "mock", externalUserId: "external-1", email: "one@example.com", displayName: "One" };
function fixture() {
  const users: StoredUser[] = [];
  const sessions: StoredSession[] = [];
  const attempts = new Map<string, { count: number; start: number }>();
  const repository: AuthRepository = {
    async consumeAttempt(key, now) {
      const previous = attempts.get(key);
      const next = !previous || now.getTime() - previous.start >= 900_000 ? { count: 1, start: now.getTime() } : { ...previous, count: previous.count + 1 };
      attempts.set(key, next);
      return next.count <= 5;
    },
    async upsertUser(value, role) {
      let user = users.find((u) => u.provider === value.provider && u.externalUserId === value.externalUserId);
      if (!user) { user = { ...value, id: "local-1", role, isActive: true }; users.push(user); }
      return user;
    },
    async createSession(session) { sessions.push({ ...session, revokedAt: null, user: users.find((u) => u.id === session.userId)! }); },
    async findSession(hash) { return sessions.find((s) => s.tokenHash === hash) ?? null; },
    async revokeSession(hash, now) { const session = sessions.find((s) => s.tokenHash === hash); if (session) session.revokedAt = now; },
  };
  let now = new Date("2026-09-08T00:00:00Z");
  const service = new AuthService(repository, { authenticate: async () => identity }, { now: () => now });
  return { service, users, sessions, setNow: (value: Date) => { now = value; } };
}

describe("authentication providers", () => {
  it("disables login unless a provider is explicitly configured", async () => {
    await expect(createAuthProvider({}).authenticate("one@example.com", "secret")).rejects.toMatchObject({ status: 503 });
  });
  it("requires a configured salted password hash and never accepts arbitrary emails", async () => {
    const passwordHash = await hashMockPassword("test-password");
    const provider = createAuthProvider({ AUTH_PROVIDER: "mock", AUTH_MOCK_USERS_JSON: JSON.stringify([{ ...identity, passwordHash }]) });
    expect(await provider.authenticate(" ONE@example.com ", "test-password")).toEqual(identity);
    await expect(provider.authenticate("one@example.com", "wrong")).rejects.toMatchObject({ status: 401 });
    await expect(provider.authenticate("unknown@example.com", "test-password")).rejects.toMatchObject({ status: 401 });
    expect(await hashMockPassword("test-password")).not.toBe(passwordHash);
  });
  it("fails closed on external failures, malformed identities, and insecure URLs", async () => {
    for (const result of [new Response("no", { status: 500 }), Response.json({ user: { email: "one@example.com" } })]) {
      const provider = createAuthProvider({ AUTH_PROVIDER: "external", AUTH_EXTERNAL_URL: "https://identity.example/login", AUTH_EXTERNAL_PROVIDER_ID: "company" }, async () => result);
      await expect(provider.authenticate("one@example.com", "password")).rejects.toMatchObject({ status: 503 });
    }
    await expect(createAuthProvider({ AUTH_PROVIDER: "external", AUTH_EXTERNAL_URL: "http://identity.example/login", AUTH_EXTERNAL_PROVIDER_ID: "company" }).authenticate("one@example.com", "password")).rejects.toMatchObject({ status: 503 });
  });
  it("returns only the external identity, ignoring upstream roles and tokens", async () => {
    const provider = createAuthProvider({ AUTH_PROVIDER: "external", AUTH_EXTERNAL_URL: "https://identity.example/login", AUTH_EXTERNAL_PROVIDER_ID: "company" }, async () => Response.json({ token: "secret", user: { id: "123", email: "one@example.com", name: "One", role: "ADMIN" } }));
    expect(await provider.authenticate("one@example.com", "password")).toEqual({ ...identity, provider: "company", externalUserId: "123" });
  });
});

describe("persistent sessions", () => {
  it("stores only a hash, resolves identity, expires after 8 hours, and revokes logout", async () => {
    const f = fixture();
    const first = await f.service.login("one@example.com", "password");
    expect(first.token).toMatch(/^[a-f0-9]{64}$/);
    expect(f.sessions[0].tokenHash).not.toBe(first.token);
    expect(await f.service.getUser(first.token)).toEqual({ id: "local-1", email: "one@example.com", displayName: "One", role: "USER" });
    await f.service.logout(first.token);
    expect(await f.service.getUser(first.token)).toBeNull();
    const second = await f.service.login("one@example.com", "password");
    f.setNow(new Date("2026-09-08T08:00:00Z"));
    expect(await f.service.getUser(second.token)).toBeNull();
  });
  it("denies disabled users at both login and session lookup", async () => {
    const f = fixture();
    const login = await f.service.login("one@example.com", "password");
    f.users[0].isActive = false;
    expect(await f.service.getUser(login.token)).toBeNull();
    await expect(f.service.login("one@example.com", "password")).rejects.toMatchObject({ status: 401 });
  });
  it("counts normalized email attempts durably and allows retry after the window", async () => {
    const f = fixture();
    for (let i = 0; i < 5; i++) await f.service.login(" ONE@example.com ", "password");
    await expect(f.service.login("one@example.com", "password")).rejects.toMatchObject({ status: 429 });
    f.setNow(new Date("2026-09-08T00:15:00Z"));
    await expect(f.service.login("one@example.com", "password")).resolves.toHaveProperty("token");
  });
});

describe("auth HTTP protections", () => {
  it("rejects cross origin and missing origin mutations", () => {
    for (const origin of [undefined, "https://evil.example", "null"]) {
      expect(() => assertSameOrigin(new Request("https://timeline.example/api/auth/login", { method: "POST", headers: origin ? { origin } : {} }))).toThrow();
    }
    expect(() => assertSameOrigin(new Request("https://timeline.example/api/auth/login", { method: "POST", headers: { origin: "https://timeline.example" } }))).not.toThrow();
  });
  it("sets secure cookie attributes in production and makes errors noncacheable", async () => {
    expect(sessionCookieOptions(true)).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 28800 });
    try { assertSameOrigin(new Request("https://timeline.example/api", { method: "POST" })); } catch (error) {
      const response = authErrorResponse(error)!;
      expect(response.status).toBe(403);
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    }
  });
});

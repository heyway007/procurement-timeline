// @vitest-environment node
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createPrismaClient, runWithPrisma } from "@/lib/db/prisma";
import { PrismaAuthRepository } from "@/lib/auth/repository";
import { AuthService } from "@/lib/auth/service";

// Explicit disposable migrated database only. Never implicitly use DATABASE_URL.
const databaseUrl = process.env.TEST_DATABASE_URL;
describe.skipIf(!databaseUrl)("PostgreSQL auth integration", () => {
  const client = databaseUrl ? createPrismaClient(databaseUrl) : null;
  const externalUserId = `auth-test-${randomUUID()}`;
  const emailHash = `auth-test-${randomUUID()}`;
  afterAll(async () => {
    if (!client) return;
    await client.user.deleteMany({ where: { externalUserId, provider: "test" } });
    await client.authLoginAttempt.deleteMany({ where: { emailHash } });
    await client.$disconnect();
  });
  it("atomically accepts only five concurrent attempts in a window", async () => {
    await runWithPrisma(client!, async () => {
      const repo = new PrismaAuthRepository();
      const now = new Date();
      const results = await Promise.all(Array.from({ length: 12 }, () => repo.consumeAttempt(emailHash, now)));
      expect(results.filter(Boolean)).toHaveLength(5);
      expect(await repo.consumeAttempt(emailHash, new Date(now.getTime() + 900_000))).toBe(true);
    });
  });
  it("persists session revocation and never refreshes local roles from the provider", async () => {
    await runWithPrisma(client!, async () => {
      const repo = new PrismaAuthRepository();
      const identity = { provider: "test", externalUserId, email: `${externalUserId}@example.com`, displayName: "Test" };
      const created = await repo.upsertUser(identity, "USER");
      expect((await repo.upsertUser(identity, "ADMIN")).role).toBe("USER");
      const service = new AuthService(repo, { authenticate: async () => identity });
      const login = await service.login(identity.email, "temporary-test-value");
      expect((await service.getUser(login.token))?.id).toBe(created.id);
      await service.logout(login.token);
      expect(await service.getUser(login.token)).toBeNull();
      const second = await service.login(identity.email, "temporary-test-value");
      await client!.user.update({ where: { id: created.id }, data: { isActive: false } });
      expect(await service.getUser(second.token)).toBeNull();
      await expect(service.login(identity.email, "temporary-test-value")).rejects.toMatchObject({ status: 401 });
      // Remove this test's credential-attempt row while preserving all other data.
      const { createHash } = await import("node:crypto");
      await client!.authLoginAttempt.deleteMany({ where: { emailHash: createHash("sha256").update(identity.email).digest("hex") } });
    });
  });
});

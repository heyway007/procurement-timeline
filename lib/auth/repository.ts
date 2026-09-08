import { getPrisma } from "@/lib/db/prisma";
import type { AuthIdentity, AuthUser } from "./types";
import type { AuthRepository, SessionInput } from "./service";

export class PrismaAuthRepository implements AuthRepository {
  async consumeAttempt(emailHash: string, now: Date): Promise<boolean> {
    const cutoff = new Date(now.getTime() - 15 * 60 * 1000);
    // One atomic PostgreSQL UPSERT serializes competing attempts for this email.
    const rows = await getPrisma().$queryRaw<{ attemptCount: number }[]>`
      INSERT INTO "AuthLoginAttempt" ("emailHash", "windowStartedAt", "attemptCount")
      VALUES (${emailHash}, ${now}, 1)
      ON CONFLICT ("emailHash") DO UPDATE SET
        "attemptCount" = CASE WHEN "AuthLoginAttempt"."windowStartedAt" <= ${cutoff} THEN 1 ELSE LEAST("AuthLoginAttempt"."attemptCount" + 1, 6) END,
        "windowStartedAt" = CASE WHEN "AuthLoginAttempt"."windowStartedAt" <= ${cutoff} THEN ${now} ELSE "AuthLoginAttempt"."windowStartedAt" END
      RETURNING "attemptCount"
    `;
    return rows[0].attemptCount <= 5;
  }
  async upsertUser(identity: AuthIdentity, initialRole: AuthUser["role"]) {
    return getPrisma().user.upsert({
      where: { provider_externalUserId: { provider: identity.provider, externalUserId: identity.externalUserId } },
      create: { ...identity, role: initialRole },
      update: { email: identity.email, displayName: identity.displayName },
    });
  }
  async createSession(input: SessionInput) { await getPrisma().session.create({ data: input }); }
  async findSession(tokenHash: string) { return getPrisma().session.findUnique({ where: { tokenHash }, include: { user: true } }); }
  async revokeSession(tokenHash: string, now: Date) { await getPrisma().session.updateMany({ where: { tokenHash, revokedAt: null }, data: { revokedAt: now } }); }
}

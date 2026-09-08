import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { AuthIdentity, AuthUser } from "./types";
import type { AuthProvider } from "./provider";
import { normalizeEmail } from "./provider";
import { AuthError, invalidCredentials } from "./errors";

export type StoredUser = AuthUser & AuthIdentity & { isActive: boolean };
export type SessionInput = { userId: string; tokenHash: string; expiresAt: Date };
export type StoredSession = SessionInput & { revokedAt: Date | null; user: StoredUser };
export interface AuthRepository {
  consumeAttempt(emailHash: string, now: Date): Promise<boolean>;
  upsertUser(identity: AuthIdentity, initialRole: AuthUser["role"]): Promise<StoredUser>;
  createSession(input: SessionInput): Promise<void>;
  findSession(tokenHash: string): Promise<StoredSession | null>;
  revokeSession(tokenHash: string, now: Date): Promise<void>;
}
export const SESSION_SECONDS = 8 * 60 * 60;
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const publicUser = (user: StoredUser): AuthUser => ({ id: user.id, email: user.email, displayName: user.displayName, role: user.role });
const credentialsSchema = z.object({ email: z.email().max(254), password: z.string().min(1).max(1024) });

export class AuthService {
  constructor(private readonly repository: AuthRepository, private readonly provider: AuthProvider, private readonly options: { now?: () => Date; adminExternalIds?: string[] } = {}) {}
  private now() { return this.options.now?.() ?? new Date(); }
  async login(rawEmail: string, password: string): Promise<{ user: AuthUser; token: string; expiresAt: Date }> {
    const email = normalizeEmail(rawEmail);
    if (!credentialsSchema.safeParse({ email, password }).success) throw invalidCredentials();
    const now = this.now();
    if (!await this.repository.consumeAttempt(sha256(email), now)) throw new AuthError("TOO_MANY_LOGIN_ATTEMPTS", 429);
    const identity = await this.provider.authenticate(email, password);
    const user = await this.repository.upsertUser(identity, this.options.adminExternalIds?.includes(identity.externalUserId) ? "ADMIN" : "USER");
    if (!user.isActive) throw invalidCredentials();
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000);
    await this.repository.createSession({ userId: user.id, tokenHash: sha256(token), expiresAt });
    return { user: publicUser(user), token, expiresAt };
  }
  async getUser(token: string | undefined): Promise<AuthUser | null> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    const session = await this.repository.findSession(sha256(token));
    if (!session || session.revokedAt || session.expiresAt <= this.now() || !session.user.isActive) return null;
    return publicUser(session.user);
  }
  async logout(token: string | undefined): Promise<void> {
    if (token && /^[a-f0-9]{64}$/.test(token)) await this.repository.revokeSession(sha256(token), this.now());
  }
}

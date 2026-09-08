import { z } from "zod";
import type { AuthIdentity } from "./types";
import { invalidCredentials, providerUnavailable } from "./errors";
import { verifyMockPassword } from "./password";

export interface AuthProvider { authenticate(email: string, password: string): Promise<AuthIdentity> }
export type AuthEnvironment = Record<string, string | undefined>;
export const normalizeEmail = (email: string) => email.trim().toLowerCase();
const emailSchema = z.email().max(254);
const mockSchema = z.array(z.object({ externalUserId: z.string().min(1).max(255), email: emailSchema, displayName: z.string().min(1).max(255), passwordHash: z.string().min(1) }));
const responseSchema = z.object({ user: z.object({ id: z.string().min(1).max(255), email: emailSchema, name: z.string().min(1).max(255) }) });

export function createAuthProvider(env: AuthEnvironment = process.env, fetcher: typeof fetch = fetch): AuthProvider {
  return {
    async authenticate(rawEmail, password) {
      const email = normalizeEmail(rawEmail);
      if (env.AUTH_PROVIDER === "mock") {
        let entries: z.infer<typeof mockSchema>;
        try { entries = mockSchema.parse(JSON.parse(env.AUTH_MOCK_USERS_JSON ?? "")); } catch { throw providerUnavailable(); }
        if (new Set(entries.map((u) => normalizeEmail(u.email))).size !== entries.length || new Set(entries.map((u) => u.externalUserId)).size !== entries.length) throw providerUnavailable();
        const user = entries.find((entry) => normalizeEmail(entry.email) === email);
        // Also derive for unknown users to avoid a cheap account-existence timing oracle.
        const hash = user?.passwordHash ?? "pbkdf2-sha256$100000$00000000000000000000000000000000$0000000000000000000000000000000000000000000000000000000000000000";
        const matches = await verifyMockPassword(password, hash);
        if (!user || !matches) throw invalidCredentials();
        return { provider: "mock", externalUserId: user.externalUserId, email: normalizeEmail(user.email), displayName: user.displayName };
      }
      if (env.AUTH_PROVIDER !== "external") throw providerUnavailable();
      let endpoint: URL;
      try { endpoint = new URL(env.AUTH_EXTERNAL_URL ?? ""); } catch { throw providerUnavailable(); }
      const provider = env.AUTH_EXTERNAL_PROVIDER_ID?.trim();
      if (endpoint.protocol !== "https:" || endpoint.username || endpoint.password || !provider || provider === "mock") throw providerUnavailable();
      let response: Response;
      try {
        response = await fetcher(endpoint.toString(), {
          method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8_000),
          headers: { "Content-Type": "application/json", ...(env.AUTH_EXTERNAL_API_KEY ? { Authorization: `Bearer ${env.AUTH_EXTERNAL_API_KEY}` } : {}) },
          body: JSON.stringify({ email, password }),
        });
      } catch { throw providerUnavailable(); }
      if (response.status === 401 || response.status === 403) throw invalidCredentials();
      if (!response.ok) throw providerUnavailable();
      try {
        const { user } = responseSchema.parse(await response.json());
        return { provider, externalUserId: user.id, email: normalizeEmail(user.email), displayName: user.name };
      } catch { throw providerUnavailable(); }
    },
  };
}

import { cookies, headers } from "next/headers";
import type { AuthUser } from "./types";
import { AuthService } from "./service";
import { PrismaAuthRepository } from "./repository";
import { createAuthProvider } from "./provider";
import { AuthError, providerUnavailable } from "./errors";
import { sessionCookieName } from "./http";

export function getAuthService(): AuthService {
  let adminExternalIds: string[] = [];
  if (process.env.AUTH_ADMIN_EXTERNAL_IDS_JSON) {
    try {
      const value: unknown = JSON.parse(process.env.AUTH_ADMIN_EXTERNAL_IDS_JSON);
      if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.length > 0)) throw new Error();
      adminExternalIds = value;
    } catch { throw providerUnavailable(); }
  }
  return new AuthService(new PrismaAuthRepository(), createAuthProvider(), { adminExternalIds });
}
export async function requireUser(): Promise<AuthUser> {
  // Read request context explicitly so authenticated renders cannot become static.
  await headers();
  const token = (await cookies()).get(sessionCookieName())?.value;
  const user = await getAuthService().getUser(token);
  if (!user) throw new AuthError("UNAUTHENTICATED", 401);
  return user;
}
export async function requireAdmin(): Promise<AuthUser> {
  const user = await requireUser();
  if (user.role !== "ADMIN") throw new AuthError("FORBIDDEN", 403);
  return user;
}

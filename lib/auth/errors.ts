export class AuthError extends Error {
  constructor(public readonly code: string, public readonly status: number) {
    super(code);
    this.name = "AuthError";
  }
}
export const invalidCredentials = () => new AuthError("INVALID_CREDENTIALS", 401);
export const providerUnavailable = () => new AuthError("AUTH_PROVIDER_UNAVAILABLE", 503);

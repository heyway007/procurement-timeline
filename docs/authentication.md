# Authentication setup

Timeline delegates password authentication to the configured identity provider and keeps its own PostgreSQL users and sessions. Authentication tables require `DATABASE_URL` even when projects use Google Drive storage. Apply the Prisma migration before enabling authentication. No accounts are automatically assigned existing projects.

## Configuration

`AUTH_PROVIDER` defaults to `disabled`. Use `mock` only when you explicitly intend to run the provisional local credential adapter, or `external` after verifying the identity service contract. Failure of an external request never falls back to mock authentication. Store provider secrets in deployment secrets, not in source control.

For mock mode, `AUTH_MOCK_USERS_JSON` is a JSON array of entries containing `externalUserId`, `email`, `displayName`, and `passwordHash`. Each email and external ID must be unique. Only those entries can log in. Generate a different salted hash for every account with the exported async `hashMockPassword(password)` function in `lib/auth/password.ts`. The format is `pbkdf2-sha256$100000$<32 hex salt>$<64 hex digest>` (PBKDF2 SHA-256, 32 derived bytes). The iteration count accommodates Workerd's limit; this mock adapter is a temporary integration mechanism. Do not enter a raw password in the JSON or reuse a shared password for all users. Supply passwords to a local script through secure input rather than command-line arguments or shell history.

`AUTH_ADMIN_EXTERNAL_IDS_JSON` is a local JSON array of external IDs that should become `ADMIN` when first created. The user's persisted role and `isActive` flag remain authoritative afterward; upstream roles are ignored. Keep this allowlist aligned with the selected provider and remove bootstrap entries after provisioning. Updating the allowlist does not promote or demote existing users. Operators can change `User.role` and `User.isActive` directly in the database after verifying the provider and external ID. There is no public role-management endpoint.

## Provisional external contract

For a fresh mock setup, run `npx tsx scripts/create-mock-auth-config.ts`. It creates two random-password accounts and writes credentials plus Worker configuration under the git-ignored `.codex-logs/auth-demo/` directory. Keep both files private. Existing files cause the command to stop instead of silently replacing credentials. Build with `npm run build`, apply the additive migration with `npx prisma migrate deploy`, then deploy to the direct Worker with `npx wrangler deploy --config dist/server/wrangler.json --name timeline --keep-vars --secrets-file .codex-logs/auth-demo/worker-secrets.json`. The target is `https://timeline.workplatform.workers.dev`, not the separate Sites deployment.

When switching to the real provider, revoke mock sessions and deactivate mock users. Provider namespaces intentionally produce separate identities; map any mock-owned projects to verified real users explicitly if they need to be retained.

Set `AUTH_PROVIDER=external`, an HTTPS `AUTH_EXTERNAL_URL`, and a stable `AUTH_EXTERNAL_PROVIDER_ID` (which must not be `mock`). Optional `AUTH_EXTERNAL_API_KEY` becomes a server-only `Authorization: Bearer …` header. The adapter sends a JSON POST body `{ "email": "normalized@example.com", "password": "…" }`. Email is trimmed and lowercased; passwords are preserved. The service must respond with `{ "user": { "id": "stable-external-id", "email": "person@example.com", "name": "Display name" } }`. All fields are required strings. A 401 or 403 means invalid credentials. Other errors, malformed responses, redirects, connection failures, and an eight-second timeout fail closed as provider unavailable. Confirm this provisional contract against the real service before enabling it.

Only the provider namespace and stable external ID determine the local user identity; email is not an identity key. Upstream tokens and roles are discarded and never sent to browsers. Local sessions are independent of upstream sessions. Upstream disablement is reflected on the next login; immediate revocation of existing Timeline sessions requires setting the local user's `isActive=false` or revoking local sessions.

## Sessions and HTTP

POST `/api/auth/login` accepts JSON email/password and returns `{user}`. GET `/api/auth/me` returns `{user}` or 401. POST `/api/auth/logout` revokes the presented session and expires its cookie. All responses are non-cacheable. Both POST routes require an `Origin` exactly matching the request URL origin; scripts must send that header too.

The browser stores a random 256-bit token in an HttpOnly, SameSite=Lax cookie. In production it is Secure, named `__Host-timeline-session`, has path `/`, and no Domain attribute. Development uses `timeline-session`. PostgreSQL stores only a SHA-256 hash. Sessions expire eight hours after login with no sliding renewal. A disabled user cannot log in or reuse any session. Logout does not succeed if persistence is unavailable, so the browser does not claim revocation before it happens.

An atomic PostgreSQL upsert permits five attempts per normalized-email SHA-256 hash in a fixed fifteen-minute window, including successful attempts. Subsequent requests return 429 with `Retry-After: 900`. No client-supplied IP address or forwarding header is trusted. Operators should also apply edge request-rate limits for distributed/random-email abuse. Stale login-attempt rows can be removed after their window ends; expired or revoked session rows can be purged by an operator according to retention needs.

## Legacy project assignment

The migration adds nullable `Project.ownerUserId`. Existing rows remain unassigned and invisible to ordinary project requests. Never map by display name, email guesses, or first login. After verifying an explicit project-to-user mapping, an operator can update a known project UUID to a known local `User.id` inside a transaction. The foreign key prevents nonexistent users. Admin users still access only their own projects; admin status grants global holiday administration, not access to everyone else's projects.

## Validation

Run `npm run test:run -- tests/unit/auth-foundation.test.ts tests/unit/auth-routes.test.ts` for provider, session, cookie, and route tests. To run database persistence and concurrent login-limit tests, supply a separate migrated disposable `TEST_DATABASE_URL` and run `npm run test:run -- tests/unit/auth-repository.integration.test.ts`. These tests do not migrate any database and never fall back to `DATABASE_URL`.

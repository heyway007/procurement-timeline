# External authentication and per-user Timeline access

Approved in conversation: the external system owns authentication; Timeline stores User and Session only. Implement a configurable mock adapter until the real API contract is supplied.

- Existing PostgreSQL/Prisma persists User and Session. User identity is unique by provider + externalUserId; passwords are never persisted in those tables.
- Auth provider defaults to disabled. Mock requires explicit configuration with individually salted password hashes, no universal password or arbitrary-email login. External adapter accepts a documented provisional HTTPS login response contract and fails closed.
- Random 256-bit session token in an HttpOnly, Secure-in-production, SameSite=Lax cookie; only SHA-256 token hash is persisted. Fixed 8-hour expiry and explicit revocation on logout. Inactive users cannot authenticate or use sessions.
- Every project endpoint requires a valid session. Project ownership comes from that session, never request owner fields. Users including admins only access their own projects. Repository scoping covers list, detail and every mutation; unknown/foreign ids return 404.
- Project.ownerUserId is nullable for legacy records. Existing records are retained and remain unassigned; never infer ownership from ownerName or assign to the first login. Explicit administrative mapping is an operator procedure.
- Global holiday reads require login; writes and sync/impact previews require ADMIN. Non-admin holiday reads must not synchronize or reveal other users' project information.
- Browser login/session/logout endpoints are non-cacheable; cross-origin mutations rejected; rate limit login attempts using PostgreSQL rather than per-isolate memory. Provider secrets and upstream tokens never returned to browser.
- Login page and authenticated shell fit existing Thai TCEB design. Show signed-in name and logout; create form takes owner display name from session. Expired sessions return to login.
- Keep main checkout on master. Deploy only to Cloudflare Worker timeline at https://timeline.workplatform.workers.dev, preserve secrets. Do not deploy to Sites.

Validation: provider negative cases, expiry/revocation, forged ownership and every foreign-project mutation, route authorization, UI login flow, database migration/integration, full tests/typecheck/build, deployment checks with two independent sessions.

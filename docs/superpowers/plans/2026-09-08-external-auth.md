# External Auth Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for independent units and a final security review.

**Goal:** Authenticate against a mock replaceable external provider and isolate each user's Timeline data.
**Architecture:** Auth adapter + PostgreSQL User/Session + authenticated repository wrapper and protected UI shell.
**Tech Stack:** Next-compatible vinext, Cloudflare Workers, Prisma/PostgreSQL, Web Crypto, Vitest.
**Spec:** docs/superpowers/specs/2026-09-08-external-auth-design.md

## Global constraints
Work in master/main checkout; no worktrees. Preserve legacy rows without guessing ownership. No password storage in User/Session. Explicit mock configuration only. Deploy to direct Cloudflare timeline Worker.

## Task 1: Auth foundation
- [x] Write provider/session tests, observe failure, implement lib/auth modules and /api/auth routes.
- [x] Add User, Session, AuthLoginAttempt models plus additive migration, generate Prisma client.
- [x] Expose requireUser(), requireAdmin(), authErrorResponse() and AuthService.getUser().
- [x] Verify identity isolation, session expiry/revocation, origin rejection and durable login limiting.

## Task 2: Login UI
- [x] Add login form and authenticated shell, test success/failure/logout.
- [x] Protect dashboard/detail/holiday pages; use shell to load /api/auth/me and redirect unauthenticated users.
- [x] Populate read-only owner name, hide global holiday editing for regular users.

## Task 3: Project ownership and holiday permissions
- [x] Add nullable Project.ownerUserId migration/schema/type support for both storage modes.
- [x] Implement authenticated repository scope; test forged create/update owner fields and all foreign-id mutations.
- [x] Remove shared ProjectService singleton; require user per request; guard global holiday operations.
- [x] Map authentication errors and prevent cached private responses.

## Task 4: Integration, review and deployment
- [x] Test full suite/typecheck/focused lint/build and real DB migration/session integration.
- [x] Review all auth/ownership paths, resolve material findings.
- [x] Configure mock accounts with random credentials kept outside source, migrate additively, deploy direct Worker.
- [x] Verify login, private reads, cross-user denial and logout on deployed Worker; hand off credentials and integration guide.

## Completion evidence (2026-09-08)
- Full suite: 242 passed, 2 opt-in database integration tests skipped because no disposable TEST_DATABASE_URL was supplied. Typecheck and production build passed. Focused lint passed with the pre-existing dashboard set-state-in-effect rule excluded for that file.
- Security review completed; holiday preview project details are owner-filtered and confirmation tokens encrypted.
- Additive migration applied to the verified direct Worker database; all 15 legacy projects remain unassigned and intact.
- Deployed Worker version: 16bd592e-6c55-4b15-83b2-feae1b8bf88b.
- Live verification passed: anonymous denial, invalid credentials, two-account login, secure cookies, server-assigned ownership, cross-user read/update/delete denial, holiday roles/privacy, same-origin enforcement, logout revocation.
- Temporary live test projects removed; both test sessions revoked. Database check confirms 15 original projects and two mock users.
- Login page visually checked in browser. Private credentials are in .codex-logs/auth-demo/accounts.txt; external provider contract remains provisional pending the user's actual API.
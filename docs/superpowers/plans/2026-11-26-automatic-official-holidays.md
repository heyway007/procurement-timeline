# Automatic Official Holidays Implementation Plan

> **For agentic workers:** Use test-driven development for each task; execute independent source and repository work in parallel, then integrate and review the whole change.

**Goal:** Automatically discover official holidays and replace advance projections safely.

**Architecture:** A bounded SOC source adapter returns publication completeness/cache metadata. A shared coordinator controls retry timing and imports. Repository annual-authority markers suppress projections consistently; calendar GET and a daily Worker trigger invoke the coordinator.

**Tech Stack:** TypeScript, Next/Vinext, Cloudflare Worker, Prisma/PostgreSQL, Google Drive JSON, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-automatic-official-holidays-design.md`

## Global Constraints

- Main working tree on `master`, no worktrees. The user authorized commit + push to `origin/master` to trigger production deployment.
- Preserve manual holidays, separately sourced special announcements, and existing project dates.
- Failed or incomplete remote reads do not promote official completeness.

## Review Focus

- Full-vs-partial publication confusion must not remove valid dates.
- All calendar readers must honor the same annual marker.
- Automatic imports must not report cached fallback as live confirmation.
- Inaccessible sources must retain usable data and obey retry cooldown.
- Worker scheduled work must initialize runtime storage and release database connections.

### Task 1: Source discovery and classification

- [x] Add failing unknown-2027-source, partial, malformed-date, and cached-fallback tests.
- [x] Discover official posts by year, normalize HTML/table dates, and return `{holidays, coverage: FULL_YEAR|PARTIAL, cached}`; keep the existing `fetchYear` API compatible.
- [x] Run source tests to green.

### Task 2: Authoritative repository reads and imports

- [x] Add failing moved-date, partial, manual/special-preservation, and legacy-Drive tests.
- [x] Add nullable `officialCalendarCompleteAt`/`officialAnnualSourceUrl`, migration and local generated client.
- [x] Extend `reconcileOfficialYear(..., options?: {complete?: boolean})` and all four planning reads.
- [x] Make manual Prisma holiday edits clear official ownership.
- [x] Run repository suites to green.

### Task 3: Automatic checks and daily trigger

- [x] Add failing cooldown, deduplication, calendar GET and Worker scheduled tests.
- [x] Add a coordinator independent of preview secrets; share it with the holiday service and daily Worker handler.
- [x] Configure daily 00:00 UTC cron; initialize runtime bindings and scope/disconnect Prisma.
- [x] Serialize Drive mutations within one store to prevent overlapping local import/project writes; do not claim a distributed lock.
- [x] Test offline/source failure and successful replacement through the real coordinator/repository boundary.

### Task 4: Verification and review

- [x] Run all tests, typecheck, changed-file lint and production build.
- [x] Independently review integration and correct important findings with regression tests.
- [x] Record the actual verification and remaining source/deployment limitations.

# Google Drive Storage Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `google_drive` backend mode that stores projects, holidays, and holiday coverage in one Google Drive JSON file while keeping PostgreSQL as the default.

**Architecture:** Keep all business rules in the existing services and swap only repository implementations through the existing containers. Add a shared Google Drive JSON datastore that authenticates with a service account, initializes the approved template, and exposes transactional read/modify/write helpers to Google Drive repositories.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Prisma 7/PostgreSQL, Google Drive API v3 through `googleapis`, Zod, Vitest.

## Global Constraints

- `STORAGE_MODE=postgres` or unset keeps the existing Prisma/PostgreSQL repositories.
- `STORAGE_MODE=google_drive` uses one JSON file on Google Drive as the source of truth.
- Google Drive mode uses service account environment variables and must not require app users to log in.
- The existing API contracts and UI behavior must not change.
- Missing Google Drive credentials must fail clearly instead of falling back to PostgreSQL.
- Existing exact budget, schedule, manual-date, and holiday rules remain authoritative in services.

---

### Task 1: Add storage-mode configuration and container selection

**Files:**
- Create: `lib/storage/config.ts`
- Modify: `lib/projects/container.ts`
- Modify: `lib/holidays/container.ts`
- Create: `tests/unit/storage-config.test.ts`

**Interfaces:**
- Produces: `storageModeFromEnv(env: NodeJS.ProcessEnv): "postgres" | "google_drive"`.
- Produces: `assertGoogleDriveEnv(env: NodeJS.ProcessEnv): GoogleDriveStorageConfig`.
- Later tasks consume `GoogleDriveStorageConfig` with `clientEmail`, `privateKey`, `fileId`, `folderId`, and `fileName`.

- [ ] Write failing tests proving unset/`postgres` returns PostgreSQL, `google_drive` validates required service account values, escaped private-key newlines are normalized, and invalid values throw `STORAGE_MODE_UNSUPPORTED`.
- [ ] Run `npm test -- --run tests/unit/storage-config.test.ts`; expect FAIL because `lib/storage/config.ts` does not exist.
- [ ] Implement `lib/storage/config.ts` with exact env parsing and clear errors: `GOOGLE_DRIVE_CLIENT_EMAIL_NOT_CONFIGURED`, `GOOGLE_DRIVE_PRIVATE_KEY_NOT_CONFIGURED`, `GOOGLE_DRIVE_FILE_TARGET_NOT_CONFIGURED`, and `STORAGE_MODE_UNSUPPORTED`.
- [ ] Update project and holiday containers to branch on `storageModeFromEnv(process.env)` but keep Prisma for `postgres`.
- [ ] Run `npm test -- --run tests/unit/storage-config.test.ts`; expect PASS.
- [ ] Commit config/container selection.

### Task 2: Add Google Drive JSON datastore

**Files:**
- Create: `lib/google-drive/schema.ts`
- Create: `lib/google-drive/datastore.ts`
- Create: `tests/unit/google-drive-datastore.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `GoogleDriveStorageConfig` from Task 1.
- Produces: `GoogleDriveDocument`, `createEmptyGoogleDriveDocument(nowIso: string)`, and `GoogleDriveDataStore`.
- Produces: datastore methods `read(): Promise<GoogleDriveDocument>` and `mutate<T>(mutation: (document: GoogleDriveDocument) => T | Promise<T>): Promise<T>`.

- [ ] Add `googleapis` dependency.
- [ ] Write failing tests using a fake Drive file client for: creating an empty document with approved template, reading an existing document, saving a mutation, and surfacing invalid JSON as `GOOGLE_DRIVE_DATA_INVALID`.
- [ ] Run `npm test -- --run tests/unit/google-drive-datastore.test.ts`; expect FAIL because datastore files do not exist.
- [ ] Implement schema validation with Zod for document shape, projects, steps, holidays, and year coverage.
- [ ] Implement a small Drive file client abstraction inside `datastore.ts`, with the real client backed by `googleapis` and tests using a fake client.
- [ ] Implement initialization so a missing file creates JSON with `APPROVED_TEMPLATE_KEY` and `APPROVED_TEMPLATE_STEPS`.
- [ ] Run `npm test -- --run tests/unit/google-drive-datastore.test.ts`; expect PASS.
- [ ] Commit datastore and dependency changes.

### Task 3: Implement Google Drive project repository

**Files:**
- Create: `lib/google-drive/project-repository.ts`
- Create: `tests/unit/google-drive-project-repository.test.ts`
- Modify: `lib/projects/container.ts`

**Interfaces:**
- Consumes: `GoogleDriveDataStore`.
- Produces: `GoogleDriveProjectRepository implements ProjectRepository, HolidayCalendarReader`.

- [ ] Write failing tests proving list filter/search/date windows, create project, find by id, replace with matching version, replace conflict, remove, `listHolidayDates`, and `listUnverifiedYears`.
- [ ] Run `npm test -- --run tests/unit/google-drive-project-repository.test.ts`; expect FAIL because repository does not exist.
- [ ] Implement repository using JSON arrays and `crypto.randomUUID()` for ids.
- [ ] Sort list results by `updatedAt` descending to match the Prisma repository.
- [ ] Increment project `version` on successful replace and preserve all project step fields.
- [ ] Wire `getProjectService()` to instantiate `GoogleDriveProjectRepository` when `STORAGE_MODE=google_drive`.
- [ ] Run `npm test -- --run tests/unit/google-drive-project-repository.test.ts tests/unit/storage-config.test.ts`; expect PASS.
- [ ] Commit project repository.

### Task 4: Implement Google Drive holiday repository

**Files:**
- Create: `lib/google-drive/holiday-repository.ts`
- Create: `tests/unit/google-drive-holiday-repository.test.ts`
- Modify: `lib/holidays/container.ts`

**Interfaces:**
- Consumes: `GoogleDriveDataStore`.
- Consumes: `GoogleDriveProjectRepository` for affected-project listing.
- Produces: `GoogleDriveHolidayRepository implements HolidayRepository`.

- [ ] Write failing tests proving year listing, all-date listing, create/update/delete holiday mutation, verify year, affected-project filtering, official reconcile insert/update/manual conflict, and sync failure recording.
- [ ] Run `npm test -- --run tests/unit/google-drive-holiday-repository.test.ts`; expect FAIL because repository does not exist.
- [ ] Implement holiday repository methods with the same record shape as `PrismaHolidayRepository`.
- [ ] Preserve manual holidays when official sync returns the same date.
- [ ] Wire `getHolidayService()` to instantiate `GoogleDriveHolidayRepository` and a shared `GoogleDriveProjectRepository` when `STORAGE_MODE=google_drive`.
- [ ] Run `npm test -- --run tests/unit/google-drive-holiday-repository.test.ts tests/unit/holiday-service.test.ts`; expect PASS.
- [ ] Commit holiday repository.

### Task 5: Document setup and run full verification

**Files:**
- Modify: `.env.example`
- Test: all existing tests and build commands.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: operator-facing setup notes for Google Drive mode.

- [ ] Update `.env.example` with PostgreSQL defaults plus Google Drive mode variables and comments explaining service-account sharing.
- [ ] Run `npm test -- --run`; expect all tests PASS.
- [ ] Run `npm run lint`; expect PASS.
- [ ] Run `npm run typecheck`; expect PASS.
- [ ] Run `npm run build`; expect PASS.
- [ ] Commit docs and verification cleanup.

## Self-Review

- Spec coverage: Tasks 1-5 cover storage mode selection, service-account configuration, JSON file initialization, project data, holiday data, unchanged PostgreSQL default, and setup documentation.
- Placeholder scan: The plan contains no TBD/TODO/later placeholders.
- Type consistency: `GoogleDriveStorageConfig`, `GoogleDriveDataStore`, `GoogleDriveProjectRepository`, and `GoogleDriveHolidayRepository` are introduced before later tasks consume them.

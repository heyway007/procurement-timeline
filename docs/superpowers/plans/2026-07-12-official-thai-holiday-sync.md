# Official Thai Holiday Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automatically synchronize official nationwide and Bangkok government holidays when the holiday page opens, with cached fallback and no silent project recalculation.

**Architecture:** Add official-source metadata to the holiday repository, isolate official data acquisition behind a `HolidaySource` interface, and let `HolidayService.syncYear()` reconcile validated source records transactionally. The GET holiday API performs a freshness-aware sync and returns cached records plus status; the React page renders source/scope state without blocking manual management.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Prisma 7/PostgreSQL, Zod, Vitest/Testing Library.

## Global Constraints

- Primary source is an allow-listed HTTPS page from the Office of the Secretariat of the Cabinet.
- Include `NATIONWIDE` and `BANGKOK` government holidays; this installation counts both as non-working days.
- Never overwrite or delete a manual holiday during synchronization.
- Never silently recalculate existing projects after synchronization.
- Retain cached official records when the source is unavailable or invalid.
- Parse remote content as data and enforce timeout and response-size limits.

---

### Task 1: Persist holiday origin, scope, and synchronization state

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/holidays/repository.ts`
- Modify: `lib/db/prisma-holiday-repository.ts`
- Test: `tests/unit/holiday-service.test.ts`

**Interfaces:**
- Produces: `HolidayScope = "NATIONWIDE" | "BANGKOK"`, `HolidayOrigin = "MANUAL" | "OFFICIAL_SYNC"`, `HolidaySyncStatus = "FRESH" | "CACHED" | "FAILED"`.
- Produces: `HolidayRepository.reconcileOfficialYear(year, holidays, confirmedAt)` and `recordSyncFailure(year, attemptedAt, message)`.

- [ ] **Step 1: Write failing repository/service-facing tests**

Add fixtures asserting that existing records default to `MANUAL`/`NATIONWIDE`, official metadata is returned from `listYear`, and manual records win a same-date reconciliation conflict.

- [ ] **Step 2: Run the focused tests and verify failure**

Run: `npm test -- --run tests/unit/holiday-service.test.ts`
Expected: FAIL because source metadata and reconciliation methods do not exist.

- [ ] **Step 3: Add schema and repository contracts**

Add Prisma enums and nullable source timestamps/URLs, plus sync fields on `HolidayCalendarYear`. Update mapping so old/manual inputs produce:

```ts
{ scope: "NATIONWIDE", origin: "MANUAL", officialSourceUrl: null, lastConfirmedAt: null }
```

Implement transactional official upsert that reports `{ inserted, updated, conflicts }` and does not remove missing records.

- [ ] **Step 4: Push local schema, generate client, and run tests**

Run: `npx prisma db push && npx prisma generate && npm test -- --run tests/unit/holiday-service.test.ts`
Expected: schema synchronized, client generated, focused tests PASS.

- [ ] **Step 5: Commit**

```powershell
git add prisma/schema.prisma app/generated/prisma lib/holidays/repository.ts lib/db/prisma-holiday-repository.ts tests/unit/holiday-service.test.ts
git commit -m "feat: persist official holiday sync metadata"
```

### Task 2: Acquire and normalize the official government calendar

**Files:**
- Create: `lib/holidays/official-source.ts`
- Create: `lib/holidays/official-calendar.ts`
- Create: `tests/unit/official-holiday-source.test.ts`
- Create: `tests/fixtures/soc-holidays-2569.html`

**Interfaces:**
- Produces: `OfficialHoliday { date: string; name: string; scope: HolidayScope; sourceUrl: string; sourceLabel: string }`.
- Produces: `HolidaySource.fetchYear(year: number): Promise<OfficialHoliday[]>`.
- Produces: `SocHolidaySource` with an allow-listed `https://www.soc.go.th/` URL, 8-second timeout, 2 MB response limit, and HTML content-type validation.

- [ ] **Step 1: Save a minimal official-source fixture and write failing parser tests**

Cover Buddhist-year conversion, nationwide entries, explicit Bangkok-only entries, deduplication, wrong-year rejection, ambiguous-date rejection, and an empty-publication error.

- [ ] **Step 2: Run the parser tests and verify failure**

Run: `npm test -- --run tests/unit/official-holiday-source.test.ts`
Expected: FAIL because parser/source modules do not exist.

- [ ] **Step 3: Implement pure normalization and the bounded fetch adapter**

Keep parsing independent from network code. Return sorted ISO dates and throw stable errors: `OFFICIAL_SOURCE_UNAVAILABLE`, `OFFICIAL_SOURCE_TOO_LARGE`, and `OFFICIAL_SOURCE_INVALID`.

- [ ] **Step 4: Run focused tests**

Run: `npm test -- --run tests/unit/official-holiday-source.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add lib/holidays/official-source.ts lib/holidays/official-calendar.ts tests/unit/official-holiday-source.test.ts tests/fixtures/soc-holidays-2569.html
git commit -m "feat: parse official Thai government holidays"
```

### Task 3: Add freshness-aware synchronization to the service and API

**Files:**
- Modify: `lib/holidays/service.ts`
- Modify: `lib/holidays/container.ts`
- Modify: `app/api/holidays/route.ts`
- Modify: `lib/holidays/route-utils.ts`
- Test: `tests/unit/holiday-service.test.ts`

**Interfaces:**
- Consumes: `HolidaySource.fetchYear()` and repository reconciliation methods.
- Produces: `HolidayService.listAndSyncYear(year): Promise<{ holidays; sync; conflicts }>`.
- Produces: GET `/api/holidays?year=2026` response with `sync.status`, attempt/success timestamps, source URL, cache flag, and conflict count.

- [ ] **Step 1: Write failing sync tests**

Test successful reconciliation, cached fallback, no-cache failure, a 15-minute freshness window, and in-process promise deduplication for concurrent calls.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npm test -- --run tests/unit/holiday-service.test.ts`
Expected: FAIL because `listAndSyncYear` is absent.

- [ ] **Step 3: Implement service orchestration and API response**

Inject `HolidaySource`, keep a per-year in-flight promise map, use cached results inside the freshness window, and convert source errors into `CACHED` or `FAILED` state without deleting data. Do not call project replacement/recalculation from this flow.

- [ ] **Step 4: Run service tests and typecheck**

Run: `npm test -- --run tests/unit/holiday-service.test.ts && npm run typecheck`
Expected: PASS with no TypeScript errors.

- [ ] **Step 5: Commit**

```powershell
git add lib/holidays/service.ts lib/holidays/container.ts lib/holidays/route-utils.ts app/api/holidays/route.ts tests/unit/holiday-service.test.ts
git commit -m "feat: synchronize and cache official holidays"
```

### Task 4: Show automatic synchronization and provenance in the holiday UI

**Files:**
- Modify: `components/holidays/holiday-manager.tsx`
- Modify: `tests/components/holiday-manager.test.tsx`

**Interfaces:**
- Consumes: GET holiday response from Task 3.
- Produces: visible fresh/cached/failed status, last successful update, official link, scope badge, origin badge, and conflict warning.

- [ ] **Step 1: Write failing component tests**

Assert fetch occurs on initial load and year change; `ทั่วประเทศ`, `กรุงเทพมหานคร`, `ราชการ`, and `เพิ่มเอง` badges render; cached failure keeps rows visible; official source links use `rel="noreferrer"`.

- [ ] **Step 2: Run the component tests and verify failure**

Run: `npm test -- --run tests/components/holiday-manager.test.tsx`
Expected: FAIL because synchronization status and badges are absent.

- [ ] **Step 3: Implement the non-blocking synchronization UI**

Clear stale errors before each year request, retain cached rows on failure, show loading/status copy, render provenance badges, and preserve the manual add/impact-confirmation modal.

- [ ] **Step 4: Run focused and full verification**

Run: `npm test -- --run tests/components/holiday-manager.test.tsx && npm test -- --run && npm run lint && npm run typecheck && npm run build`
Expected: all tests PASS, lint/typecheck clean, production build succeeds.

- [ ] **Step 5: Browser smoke test**

Open `http://localhost:3000/holidays`, select 2026, verify official/Bangkok badges and source status, simulate an unavailable source, and confirm cached rows remain visible.

- [ ] **Step 6: Commit**

```powershell
git add components/holidays/holiday-manager.tsx tests/components/holiday-manager.test.tsx
git commit -m "feat: display official holiday synchronization"
```

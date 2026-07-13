# Bid Submission Time and Present Chaining Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist an immediately saved bid-submission time selector for every budget category, clean up timeline and print copy, and make the automatic three-day Present window push every later milestone forward without overlap.

**Architecture:** Add shared milestone-kind and time-slot helpers in the schedule domain, carry an optional time slot through scheduled milestones and both repositories, and expose one semantic project update endpoint that identifies the bid-submission milestone by label rather than order. Correct the approved Present duration at the source and lazily normalize legacy automatic projects on detail load while preserving valid manual anchors. The timeline component renders normalized copy, saves the dropdown immediately, and substitutes plain time text in print.

**Tech Stack:** TypeScript 6, React 19, Next.js route handlers, Zod 4, Prisma 7/PostgreSQL, Google Drive JSON storage, Vitest/Testing Library, vinext/Sites.

## Global Constraints

- Time slots are exactly `MORNING` (`8.30 น. - 12.00 น.`) and `AFTERNOON` (`13.30 น. - 16.30 น.`).
- Missing stored time slots resolve to `MORNING` for backward compatibility.
- Identify bid submission and Present milestones by canonical label text, never by order.
- A time change increments project version once and never changes dates or durations.
- Automatic Present duration is three working days; manually selected Present remains a one-working-day anchor.
- Existing public Sites access remains unchanged.

---

### Task 1: Correct schedule-domain semantics

**Files:**
- Create: `lib/schedule/milestone-kind.ts`
- Modify: `lib/schedule/types.ts`
- Modify: `lib/schedule/approved-template.ts`
- Modify: `lib/schedule/engine.ts`
- Test: `tests/unit/approved-template.test.ts`
- Test: `tests/unit/schedule-engine.test.ts`

**Interfaces:**
- Produces: `BidSubmissionTimeSlot`, `BID_SUBMISSION_TIME_SLOTS`, `bidSubmissionTimeLabel()`, `isBidSubmissionMilestone()`, `isPresentMilestone()`, and `effectiveBidSubmissionTimeSlot()`.
- Produces: optional `bidSubmissionTimeSlot` on `TemplateStep`/`ScheduledMilestone`.
- Preserves: all existing schedule engine entry points.

- [ ] **Step 1: Write failing template and engine tests**

Add assertions that approved Present has `workingDaysToNext: 3`, the approved total is 39, the small-budget duration vector is `[4, 1, 5, 1, 1, 3, 4, 4, 1, 7]`, and every budget category's bid-submission milestone defaults to `MORNING`. Add the reported holiday scenario:

```ts
const holidays = new Set(["2026-07-28", "2026-07-29", "2026-07-30"]);
const result = buildTimeline(
  approvedTemplateStepsForBudgetCategory("ONE_TO_FIVE_MILLION"),
  "2026-07-06",
  holidays,
);
const present = result.milestones.find((step) => step.label.includes("Present"));
const following = result.milestones[presentIndex + 1];
expect(present).toMatchObject({ scheduledDate: "2026-07-27", workingDaysToNext: 3 });
expect(following.scheduledDate).toBe("2026-08-04");
```

- [ ] **Step 2: Run the domain tests and verify RED**

Run: `npx vitest run tests/unit/approved-template.test.ts tests/unit/schedule-engine.test.ts`

Expected: FAIL because Present is still one day, totals remain 37/29, and time-slot fields/helpers do not exist.

- [ ] **Step 3: Add shared milestone helpers and types**

Create `lib/schedule/milestone-kind.ts` with:

```ts
export const BID_SUBMISSION_TIME_SLOTS = ["MORNING", "AFTERNOON"] as const;
export type BidSubmissionTimeSlot = (typeof BID_SUBMISSION_TIME_SLOTS)[number];

export const BID_SUBMISSION_TIME_LABELS: Record<BidSubmissionTimeSlot, string> = {
  MORNING: "8.30 น. - 12.00 น.",
  AFTERNOON: "13.30 น. - 16.30 น.",
};

export function isBidSubmissionMilestone(label: string): boolean {
  return label.includes("กำหนดวันเสนอราคา");
}

export function isPresentMilestone(label: string): boolean {
  return label.includes("Present");
}

export function effectiveBidSubmissionTimeSlot(
  value?: BidSubmissionTimeSlot,
): BidSubmissionTimeSlot {
  return value ?? "MORNING";
}

export function bidSubmissionTimeLabel(value?: BidSubmissionTimeSlot): string {
  return BID_SUBMISSION_TIME_LABELS[effectiveBidSubmissionTimeSlot(value)];
}
```

Add `bidSubmissionTimeSlot?: BidSubmissionTimeSlot` to `TemplateStep`. Import the shared `isPresentMilestone()` in the engine and copy `bidSubmissionTimeSlot` into each scheduled milestone.

- [ ] **Step 4: Correct the approved template**

Set the canonical bid-submission step to `bidSubmissionTimeSlot: "MORNING"` and the canonical Present step to `workingDaysToNext: 3`. Preserve those properties through `stepFromApprovedTemplate()` and budget-specific template mapping.

- [ ] **Step 5: Run the domain tests and verify GREEN**

Run: `npx vitest run tests/unit/approved-template.test.ts tests/unit/schedule-engine.test.ts`

Expected: both files pass, including the non-overlapping 27 July–3 August Present window followed by 4 August.

- [ ] **Step 6: Commit the schedule-domain change**

```powershell
git add lib/schedule/milestone-kind.ts lib/schedule/types.ts lib/schedule/approved-template.ts lib/schedule/engine.ts tests/unit/approved-template.test.ts tests/unit/schedule-engine.test.ts
git commit -m "fix: chain schedule after present window"
```

---

### Task 2: Persist bid-submission slots in both storage modes

**Files:**
- Modify: `lib/google-drive/schema.ts`
- Modify: `lib/db/prisma-project-repository.ts`
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/20260713190000_add_bid_submission_time_slot/migration.sql`
- Test: `tests/unit/google-drive-project-repository.test.ts`
- Test: `tests/unit/google-drive-datastore.test.ts`

**Interfaces:**
- Consumes: `BidSubmissionTimeSlot` from Task 1.
- Produces: backward-compatible Google Drive parsing and Prisma mappings that round-trip the optional slot.

- [ ] **Step 1: Write failing storage tests**

Extend the Google Drive fixture/project repository tests so an old project without the field still parses and returns `undefined`, while a project whose bid step contains `bidSubmissionTimeSlot: "AFTERNOON"` round-trips through create/replace. Assert non-bid steps remain unchanged.

- [ ] **Step 2: Run storage tests and verify RED**

Run: `npx vitest run tests/unit/google-drive-datastore.test.ts tests/unit/google-drive-project-repository.test.ts`

Expected: FAIL because the Google Drive schema strips the new field.

- [ ] **Step 3: Extend the Google Drive schema**

Define one reusable schema and add it to both step shapes:

```ts
const bidSubmissionTimeSlotSchema = z.enum(["MORNING", "AFTERNOON"]);

bidSubmissionTimeSlot: bidSubmissionTimeSlotSchema.optional(),
```

Keep `schemaVersion: 1`; the field is additive and optional.

- [ ] **Step 4: Add the nullable Prisma enum and migration**

Add to `prisma/schema.prisma`:

```prisma
enum BidSubmissionTimeSlot {
  MORNING
  AFTERNOON
}

model ProjectStep {
  id                     String                    @id @default(uuid()) @db.Uuid
  projectId              String                    @db.Uuid
  order                  Int
  label                  String
  workingDaysToNext      Int
  scheduledDate          DateTime                  @db.Date
  isDateManuallyAdjusted Boolean                   @default(false)
  bidSubmissionTimeSlot  BidSubmissionTimeSlot?
  project                Project                   @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, order])
  @@index([projectId])
  @@index([scheduledDate])
}
```

Create migration SQL:

```sql
CREATE TYPE "BidSubmissionTimeSlot" AS ENUM ('MORNING', 'AFTERNOON');
ALTER TABLE "ProjectStep"
ADD COLUMN "bidSubmissionTimeSlot" "BidSubmissionTimeSlot";
```

Run: `npm run prisma:generate`

Expected: generated client includes `BidSubmissionTimeSlot` and the nullable ProjectStep field.

- [ ] **Step 5: Map the field in Prisma repository paths**

Add `bidSubmissionTimeSlot: step.bidSubmissionTimeSlot ?? undefined` in `mapProject()`, and write `bidSubmissionTimeSlot: step.bidSubmissionTimeSlot` in create and replace step payloads.

- [ ] **Step 6: Run storage tests and type checking**

Run: `npx vitest run tests/unit/google-drive-datastore.test.ts tests/unit/google-drive-project-repository.test.ts`

Run: `npm run typecheck`

Expected: all selected tests and type checking pass.

- [ ] **Step 7: Commit storage support**

```powershell
git add lib/google-drive/schema.ts lib/db/prisma-project-repository.ts prisma/schema.prisma prisma/migrations app/generated/prisma tests/unit/google-drive-datastore.test.ts tests/unit/google-drive-project-repository.test.ts
git commit -m "feat: persist bid submission time slots"
```

---

### Task 3: Add semantic service and API update flow

**Files:**
- Modify: `lib/projects/types.ts`
- Modify: `lib/projects/schema.ts`
- Modify: `lib/projects/service.ts`
- Modify: `lib/projects/http.ts`
- Create: `app/api/projects/[id]/bid-submission-time/route.ts`
- Modify: `lib/ui/api-client.ts`
- Test: `tests/unit/project-service.test.ts`
- Test: `tests/unit/project-http.test.ts`
- Test: `tests/unit/api-client.test.ts`

**Interfaces:**
- Produces: `UpdateBidSubmissionTimeInput`.
- Produces: `ProjectService.updateBidSubmissionTime(id, input)`.
- Produces: `updateBidSubmissionTime(id, timeSlot, version)` client call.

- [ ] **Step 1: Write failing service tests**

Add tests that create both small- and large-budget projects, call:

```ts
await service.updateBidSubmissionTime(project.id, {
  timeSlot: "AFTERNOON",
  version: project.version,
});
```

Assert the semantic bid step (order 4 or 7) receives `AFTERNOON`, dates/durations are identical, and version increments once. Add stale-version and invalid-slot tests. Add a legacy automatic project test proving a one-day Present is normalized to three days and downstream automatic dates shift without overwriting a valid manual anchor.

- [ ] **Step 2: Run service tests and verify RED**

Run: `npx vitest run tests/unit/project-service.test.ts tests/unit/project-http.test.ts`

Expected: FAIL because the input schema, service method, and legacy normalization do not exist.

- [ ] **Step 3: Add validated input and replacement helper**

Add:

```ts
export type UpdateBidSubmissionTimeInput = {
  timeSlot: BidSubmissionTimeSlot;
  version: number;
};

export const updateBidSubmissionTimeSchema = z.object({
  timeSlot: z.enum(BID_SUBMISSION_TIME_SLOTS),
  version: versionSchema,
});
```

Refactor `ProjectService` to use this exact helper shape so time updates and legacy schedule upgrades preserve every project field:

```ts
private replacementFrom(
  project: ProjectRecord,
  overrides: Partial<Pick<ProjectReplacement, "steps" | "processEndDate" | "isProcessEndManuallyAdjusted" | "scheduleStatus">> = {},
): ProjectReplacement
```

- [ ] **Step 4: Implement semantic time update**

`updateBidSubmissionTime()` parses input, loads the project, checks version, finds `isBidSubmissionMilestone(step.label)`, replaces only that step's slot, and calls `projects.replace()` once. Throw `MILESTONE_NOT_FOUND` if no semantic step exists.

- [ ] **Step 5: Normalize legacy automatic Present schedules on detail load**

In `get()`, after reading the project, detect an automatic Present milestone whose duration is not three. Clone its timeline with duration three, call `recalculateWithManualAnchors()` using the holiday set, and persist the upgraded timeline with optimistic concurrency. Preserve valid manual anchors. If an anchor conflicts, persist/return `scheduleStatus: "NEEDS_REVIEW"` without overwriting the manual date. Retry one read after a repository version conflict; do not loop.

- [ ] **Step 6: Add route and API client tests**

Test that the client sends:

```json
{"timeSlot":"AFTERNOON","version":3}
```

to `PATCH /api/projects/project-1/bid-submission-time`, returns the project, and maps non-JSON errors consistently. Verify Zod invalid-slot errors map to HTTP 422.

- [ ] **Step 7: Implement the route and client**

The route delegates to `service.updateBidSubmissionTime(id, await request.json())`. The client uses `requestJson<{ project: ProjectRecord }>()` and returns `result.project`.

- [ ] **Step 8: Run API/service tests and type checking**

Run: `npx vitest run tests/unit/project-service.test.ts tests/unit/project-http.test.ts tests/unit/api-client.test.ts`

Run: `npm run typecheck`

Expected: all selected tests and type checking pass.

- [ ] **Step 9: Commit service and API support**

```powershell
git add -- lib/projects lib/ui/api-client.ts 'app/api/projects/[id]/bid-submission-time' tests/unit/project-service.test.ts tests/unit/project-http.test.ts tests/unit/api-client.test.ts
git commit -m "feat: update bid submission time immediately"
```

---

### Task 4: Render dropdown, copy, and print behavior

**Files:**
- Modify: `components/timeline/timeline-detail.tsx`
- Modify: `app/globals.css`
- Modify: `tests/components/timeline-editor.test.tsx`

**Interfaces:**
- Consumes: `updateBidSubmissionTime()`, slot helpers, and the optional step field.
- Produces: immediate-save selector and normalized screen/print copy.

- [ ] **Step 1: Write failing component tests**

Add an optional `onUpdateBidSubmissionTime` prop to the desired test API and write tests for:

```ts
expect(screen.getByRole("combobox", { name: "เวลาเสนอราคา" })).toHaveValue("MORNING");
await user.selectOptions(screen.getByRole("combobox", { name: "เวลาเสนอราคา" }), "AFTERNOON");
expect(onUpdateBidSubmissionTime).toHaveBeenCalledWith("AFTERNOON", 1);
```

Also assert:

- small-budget step 4 and large-budget step 7 both get the selector;
- afternoon text becomes `กำหนดวันเสนอราคา (ตั้งแต่เวลา 13.30 น. - 16.30 น.)`;
- `ผู้ยื่นใบเสนอราคาผ่านเว็บไซต์ของกรมบัญชีกลางเท่านั้น` is a separate paragraph;
- inspection displays `ตรวจสอบเอกสารเสนอราคา` without legacy parentheses;
- the selector is disabled while the promise is pending and old value remains on rejection;
- the repeated `วันที่กำหนด` responsive span has `print-hidden`;
- print-only selected time exists and the dropdown has `print-hidden`;
- the holiday scenario displays Present `27 ก.ค.–3 ส.ค.` and the following range `4–7 ส.ค.`.

- [ ] **Step 2: Run component tests and verify RED**

Run: `npx vitest run tests/components/timeline-editor.test.tsx`

Expected: FAIL because the selector, semantic copy rendering, print time, and corrected chaining are absent.

- [ ] **Step 3: Implement normalized copy helpers**

Replace the string-only `displayStepLabel()` with semantic rendering:

```tsx
if (isBidSubmissionMilestone(step.label)) {
  return (
    <>
      <p className="font-medium text-slate-900">
        กำหนดวันเสนอราคา (ตั้งแต่เวลา {bidSubmissionTimeLabel(step.bidSubmissionTimeSlot)})
      </p>
      <p className="mt-1 text-slate-700">
        ผู้ยื่นใบเสนอราคาผ่านเว็บไซต์ของกรมบัญชีกลางเท่านั้น
      </p>
    </>
  );
}
```

Normalize the inspection label by removing ` (8.30 น. - 12.00 น.)` from existing stored copies. Keep the existing Present manual-label behavior.

- [ ] **Step 4: Implement immediate selector state**

Add `savingTimeSlot` state. On change, keep the rendered value sourced from `project`, disable the selector, call the injected handler or API client, replace project state only on success, show a Thai error on failure, and clear saving state in `finally`. Do not show a confirmation modal.

- [ ] **Step 5: Implement screen and print date rendering**

Wrap the date in a column container. For the bid row, render the select after the date with `print-hidden`; add a `.print-only` plain-text slot after the date. Add `print-hidden` to the responsive `วันที่กำหนด` label while leaving the table header untouched.

Add to `app/globals.css`:

```css
.print-only { display: none; }
@media print {
  .print-only { display: inline !important; }
}
```

- [ ] **Step 6: Run component tests and verify GREEN**

Run: `npx vitest run tests/components/timeline-editor.test.tsx`

Expected: all component tests pass.

- [ ] **Step 7: Commit UI behavior**

```powershell
git add components/timeline/timeline-detail.tsx app/globals.css tests/components/timeline-editor.test.tsx
git commit -m "feat: add bid submission time selector"
```

---

### Task 5: Verify and publish the exact source

**Files:**
- Verify only; no source changes expected.

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: validated Sites production deployment.

- [ ] **Step 1: Run the full non-baseline-broken test set**

Run: `npx vitest run --exclude tests/components/dashboard.test.tsx`

Expected: all included test files pass. Separately run `npx vitest run tests/components/dashboard.test.tsx` and record the existing duplicate responsive-layout query failures without modifying unrelated dashboard code.

- [ ] **Step 2: Run static verification**

Run: `npm run typecheck`

Run: `npx eslint lib/schedule lib/projects lib/google-drive/schema.ts lib/db/prisma-project-repository.ts lib/ui/api-client.ts components/timeline/timeline-detail.tsx app/api/projects/[id]/bid-submission-time tests/unit tests/components/timeline-editor.test.tsx`

Run: `git diff --check`

Expected: exit code 0 for all three commands.

- [ ] **Step 3: Build the Sites artifact**

Run: `npm run build`

Expected: vinext completes all five build environments and emits `dist/server/index.js` plus `dist/.openai/hosting.json`.

- [ ] **Step 4: Push, package, save, and deploy**

Obtain a fresh Sites source credential for project `appgprj_6a53c415351c819193f6dda9e391e700`, push HEAD to its configured `main` branch with a per-command authorization header, and package with:

```powershell
& 'C:\laragon\bin\git\bin\bash.exe' '/c/Users/ASUS/.codex/plugins/cache/openai-bundled/sites/0.1.27/scripts/package-site.sh' '/c/Users/ASUS/OneDrive/Documents/timeline/.worktrees/procurement-timeline' '/c/Users/ASUS/OneDrive/Documents/timeline/.worktrees/procurement-timeline/.codex-logs/site-bid-time.tar.gz'
```

Save one Sites version from the pushed HEAD and archive. Deploy the saved version to the already-approved public site, poll until `succeeded` or `failed`, and return the production URL.

- [ ] **Step 5: Confirm production handoff**

Expected production URL: `https://procurement-timeline.vjgroove.chatgpt.site`

Report the selector, corrected Present chaining, copy cleanup, and print cleanup in Thai. Include the known unrelated Dashboard test limitation only if it still reproduces.

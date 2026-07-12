# Timeline Calendar Column Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Thai weekday display and a calendar popover column to the project timeline page.

**Architecture:** Keep the feature UI-only. Add focused date-display helpers in `lib/ui/date-format.ts`, then render the new column and popover from `components/timeline/timeline-detail.tsx`.

**Tech Stack:** Next.js client component, React state-free hover/focus CSS, TypeScript, Vitest, Testing Library.

## Global Constraints

- Do not change the database schema or API payloads.
- The calendar popover is read-only; date editing remains through the existing edit dialog.
- Hide the new calendar column from print output.
- Use Thai Buddhist-year display and Asia/Bangkok date interpretation.

---

### Task 1: Thai Date And Calendar Helpers

**Files:**
- Modify: `lib/ui/date-format.ts`
- Test: `tests/components/timeline-editor.test.tsx`

**Interfaces:**
- Produces: `formatThaiDateWithWeekday(iso: string): string`
- Produces: `formatThaiFullDateWithWeekday(iso: string): string`
- Produces: `formatThaiMonthYear(iso: string): string`
- Produces: `buildMonthCalendar(iso: string): Array<{ iso: string; day: number; inMonth: boolean; selected: boolean }>`

- [ ] **Step 1: Write the failing component test**

Add this test to `tests/components/timeline-editor.test.tsx`:

```tsx
it("shows weekday dates and a focusable calendar preview", async () => {
  const user = userEvent.setup();
  render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

  expect(screen.getByText("ปฏิทิน")).toBeInTheDocument();
  expect(screen.getByText("วันจันทร์ 6 ก.ค. 2569")).toBeInTheDocument();

  await user.tab();
  await user.tab();
  await user.tab();

  const firstCalendar = screen.getByRole("button", { name: "ดูปฏิทิน วันจันทร์ 6 กรกฎาคม 2569" });
  firstCalendar.focus();

  expect(screen.getByText("กรกฎาคม 2569")).toBeInTheDocument();
  expect(screen.getByText("วันจันทร์ 6 กรกฎาคม 2569")).toBeInTheDocument();
  expect(screen.getByLabelText("วันที่เลือก 6")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --run tests/components/timeline-editor.test.tsx`

Expected: FAIL because the weekday formatter and calendar column do not exist yet.

- [ ] **Step 3: Add date helpers**

In `lib/ui/date-format.ts`, add helpers that parse ISO dates at noon Asia/Bangkok, format Thai weekday strings, format Thai full dates, format Thai month/year, and build a 42-cell Sunday-start calendar grid.

- [ ] **Step 4: Run tests to verify helper-backed UI still fails until Task 2**

Run: `npm test -- --run tests/components/timeline-editor.test.tsx`

Expected: still FAIL until the UI renders the new column.

### Task 2: Timeline Calendar Column UI

**Files:**
- Modify: `components/timeline/timeline-detail.tsx`
- Test: `tests/components/timeline-editor.test.tsx`

**Interfaces:**
- Consumes: `formatThaiDateWithWeekday`, `formatThaiFullDateWithWeekday`, `formatThaiMonthYear`, `buildMonthCalendar`

- [ ] **Step 1: Render the new columns**

Update the timeline grid columns from four columns to five columns:

```tsx
grid-cols-[4rem_1fr_11rem_5rem_7rem]
```

Use the new date formatter in milestone rows and the process-end row.

- [ ] **Step 2: Add the calendar preview control**

Add a small read-only calendar button for each milestone and the process-end row. The button should be keyboard-focusable, open the popover on hover/focus using Tailwind `group` classes, and expose an aria-label with the full Thai date.

- [ ] **Step 3: Run focused tests**

Run: `npm test -- --run tests/components/timeline-editor.test.tsx`

Expected: PASS.

- [ ] **Step 4: Run full verification**

Run:

```bash
npm test -- --run
npm run lint
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add lib/ui/date-format.ts components/timeline/timeline-detail.tsx tests/components/timeline-editor.test.tsx docs/superpowers/plans/2026-07-12-timeline-calendar-column.md
git commit -m "feat: add timeline calendar previews"
```

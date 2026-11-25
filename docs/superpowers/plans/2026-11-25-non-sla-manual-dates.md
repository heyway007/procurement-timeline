# Non-SLA manual dates implementation plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan. Steps use checkbox syntax for tracking.

**Goal:** Allow same-day non-SLA stages while preserving downstream manual dates.

**Architecture:** Add optional strict-by-default schedule options. Non-SLA edits reuse manual-anchor recalculation, synchronize actual gaps and reject conflicting anchors. Project and holiday services supply policy; the existing editor handles equal dates and collapsed ranges.

**Tech Stack:** TypeScript, React, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-11-25-non-sla-manual-dates-design.md`

## Global Constraints

- Work directly in the main working tree on `master`; no Git worktrees.
- Preserve manually chosen absolute dates for `SLA_NON_COMPLIANT`.
- No dependency changes. Keep normal SLA and specific-method signing rules.

## Review Focus

- Start-date edits must preserve manual anchors.
- Zero gaps must survive holiday recalculation and reloading.
- Conflicting preserved dates must leave storage unchanged.
- Collapsed Present, range and completion displays must remain valid.
- All seven procurement categories must support equal adjacent stage dates.

## Task 1: Engine and service policy

**Files:** `lib/schedule/date.ts`, `lib/schedule/types.ts`, `lib/schedule/engine.ts`, `lib/projects/service.ts`, `lib/projects/http.ts`, `lib/holidays/service.ts`; associated unit tests.

**Interfaces:** `countWorkingDayAdditions(from, to, holidays, allowSameDay = false)`; optional `ScheduleOptions { allowSameDay?: boolean; preserveManualDates?: boolean }` on adjustment/recalculation functions.

- [x] Add unit regressions for same-day stages across categories, preserved anchors and completion, start changes, conflicts, holiday changes, strict SLA validation and API conflict mapping.
- [x] Run targeted Vitest tests and confirm new cases fail for the reported behavior.
- [x] Implement optional policy, preserve manual anchors and synchronize incoming actual gaps; retain strict defaults and existing signing constraints.
- [x] Run targeted tests until green.

## Task 2: Editor validation and display

**Files:** `components/timeline/timeline-detail.tsx`, `tests/components/timeline-editor.test.tsx`.

**Interfaces:** Consume existing `ProjectRecord.projectStatusType`, stored gaps and existing adjustment API.

- [x] Add regressions for same-day non-SLA submission, backwards-date rejection, zero-gap range/Present/completion display and normal SLA same-date rejection.
- [x] Run component tests to observe expected failures.
- [x] Permit equality only for non-SLA; render collapsed ranges as one date and accurate duration hints.
- [x] Run component tests until green.

## Task 3: Final verification and review

- [x] Run `npm run test:run`, `npm run typecheck`, `npm run lint`.
- [x] Request independent review of the diff, focusing on the five review conditions.
- [x] Fix material findings with regressions and rerun relevant checks.
- [x] Report the verified outcome; leave changes reviewable in the main working tree.

## Progress

Execution authorized by the user's fix request and confirmation of absolute-date preservation. Continue without an additional approval round.

- Engine/service regression run: observed 19 expected failures, then 92 passing tests.
- Editor regression run: observed 13 expected failures, then 65 passing tests.
- Independent review: fixed start-only details updates, unrelated Present-window migration and incremental repair of holiday conflicts; four additional regression cases observed failing, then passing.
- Final suite: 317 passed, 2 skipped in 30 passing files and one skipped integration file.
- `npm run typecheck`: passed.
- ESLint across all 13 changed TypeScript files: passed.
- Repository-wide `npm run lint`: failed on pre-existing Dashboard effect errors and generated `dist` output (76 errors, 2539 warnings); unrelated files left intact.
- Implementation kept directly on `master`; no worktree or deployment created. The user subsequently authorized commit and push.

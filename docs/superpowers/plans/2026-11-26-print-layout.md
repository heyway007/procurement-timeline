# Timeline Print Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved print mockup and deploy through Git.

**Architecture:** Keep one timeline DOM, add semantic print hooks and a print masthead/metadata. Replace the print CSS with a four-column grid that overrides responsive screen rules.

**Tech Stack:** React, TypeScript, Tailwind CSS, Font Awesome, Vitest, Vinext, Cloudflare Workers Builds.

**Spec:** `docs/superpowers/specs/2026-11-26-print-layout-design.md`

## Global Constraints
- Work directly on master; no worktrees.
- No forced @page settings. No database or schedule changes.
- Preserve long text, notes, ranges, bid times and screen controls.
- Step text left aligned; every cell vertically centered.

## Review Focus
- Screen breakpoints must not hide print details or move dates under titles.
- Long metadata and date ranges must wrap without clipping.
- Signing title must match every other title's print size.
- Step and summary SVG icons must remain visible and bounded.
- Multi-page documents must retain complete notes and rows.

### Task 1: Print document and stylesheet
**Files:** `components/timeline/timeline-detail.tsx`, `app/globals.css`, `tests/components/timeline-editor.test.tsx`, `tests/unit/print-styles.test.ts`.

**Interfaces:** `.timeline-print-masthead`, `.print-summary`, `.timeline-print-owner`, `.timeline-print-footer`, `.timeline-step-title`, existing `.timeline-step-content`, `.timeline-step-icon`, `.timeline-step-date`, `.timeline-header-icon-slot`, `.timeline-step-column-heading`.

- [x] Add meaningful component regressions for print branding, complete metadata and visible icon wrappers; run and confirm failure.
- [x] Add the print masthead, icon metadata and shared title class without changing schedule data.
- [x] Replace print CSS with four columns: 10mm sequence, 11mm icon, flexible step, 34% date; 10.5pt titles/dates; 8pt details; left step text and centered other cells, vertically middle.
- [x] Remove obsolete layout-specific CSS regex assertions. Preserve no-@page coverage; visually verify rendered print media instead of relying on CSS string assertions for alignment.
- [x] Run component and full unit suites, typecheck, changed-file lint and production build. Inspect real print rendering including long content and screen layout.
- [ ] Obtain independent review, fix material findings, commit, push master and monitor Workers Builds until success. Verify live print markup/assets and layout.

## Execution record
User explicitly authorized implementation, commit, push and auto deployment. Component markup and CSS may be implemented in parallel because they share the semantic class contract above. No additional approval is needed.

- Three component regressions failed before the DOM changes and passed afterward. Final suite: 402 passed, 2 skipped (39 files). Typecheck and scoped ESLint passed.
- Independent review found no important issues. Production build passed without warnings.
- Chromium print-media inspection confirmed all 11 icons visible, all title sizes 14px, step text left/center vertically, date text center/center vertically, and no horizontal overflow at landscape and portrait widths.
- Generated PDFs from the real component with built CSS. A4 landscape with 10mm margins: standard 10-step project fits one page; 2,000-character notes continue across two pages. Rendered pages inspected for Thai text, icons and row alignment.
- Ruling: use 8pt secondary details and tighter balanced row spacing to keep the standard document on one page without shrinking 10.5pt main titles. Do not force these paper settings in CSS.

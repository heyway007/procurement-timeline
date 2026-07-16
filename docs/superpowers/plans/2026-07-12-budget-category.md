# Budget Category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Store and validate one of four procurement budget categories alongside the exact project budget.

**Architecture:** Define category boundaries in one pure domain module, reuse it in Zod/server validation and the client form, and persist the selected enum on `Project`. Backfill existing valid projects from their exact amount and expose the category in API/dashboard records.

**Tech Stack:** Next.js 16, React 19, TypeScript 6, Prisma 7/PostgreSQL, Zod, Vitest/Testing Library.

## Global Constraints

- Category 1 is 1,000,000–5,000,000 baht inclusive.
- Category 2 is 5,000,001–10,000,000 baht inclusive.
- Category 3 is 10,000,001–20,000,000 baht inclusive.
- Category 4 starts at 20,000,001 baht.
- Server rejects values below 1,000,000 and category/amount mismatches.
- Existing exact budget values must not change.

---

### Task 1: Define and test budget category boundaries

**Files:**
- Create: `lib/projects/budget-category.ts`
- Create: `tests/unit/budget-category.test.ts`

**Interfaces:**
- Produces: `BudgetCategory`, `BUDGET_CATEGORY_OPTIONS`, `budgetCategoryFor(amount)`, and `validateBudgetCategory(category, amount)`.

- [ ] Write tests for 999,999.99, every lower/upper boundary, and mismatch.
- [ ] Run `npm test -- --run tests/unit/budget-category.test.ts`; expect missing-module failure.
- [ ] Implement the pure mapping and Thai labels.
- [ ] Re-run focused tests; expect PASS.
- [ ] Commit domain code and tests.

### Task 2: Persist and validate project budget category

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/projects/types.ts`
- Modify: `lib/projects/schema.ts`
- Modify: `lib/projects/service.ts`
- Modify: `lib/db/prisma-project-repository.ts`
- Modify: `prisma/seed.ts`
- Test: `tests/unit/project-service.test.ts`
- Test: `tests/unit/project-http.test.ts`

**Interfaces:**
- Consumes: `validateBudgetCategory(category, amount)`.
- Produces: required `budgetCategory` on create input, records, replacements, and API JSON.

- [ ] Add failing service tests for valid category and mismatched category.
- [ ] Run focused project tests; expect mismatch test failure.
- [ ] Add Prisma enum/column and update project mappings and validation.
- [ ] Backfill local existing projects by exact amount; reject invalid legacy amounts.
- [ ] Generate Prisma client and run focused tests/typecheck; expect PASS.
- [ ] Commit persistence and server validation.

### Task 3: Add category select and dashboard label

**Files:**
- Modify: `components/dashboard/project-form.tsx`
- Modify: `components/dashboard/project-table.tsx`
- Modify: `tests/components/project-form.test.tsx`
- Modify: `tests/components/dashboard.test.tsx`

**Interfaces:**
- Consumes: `BUDGET_CATEGORY_OPTIONS` and project `budgetCategory`.
- Produces: required select, actual-budget input, Thai mismatch message, and category label below dashboard amount.

- [ ] Add failing form and dashboard tests for selection, mismatch blocking, and label display.
- [ ] Run focused component tests; expect FAIL because UI controls/labels are absent.
- [ ] Implement select, actual amount validation, and dashboard label.
- [ ] Run focused component tests; expect PASS.
- [ ] Run `npm test -- --run && npm run lint && npm run typecheck && npm run build`; expect all PASS.
- [ ] Browser-smoke-test project creation at `http://localhost:3000`.
- [ ] Commit UI changes.

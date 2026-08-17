# Automatic Project Metadata and Hidden Budget Input Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ให้ชื่อโครงการ ผู้จัดทำ และฝ่ายยังอยู่ในฟอร์มแบบไม่บังคับกรอก ซ่อนเฉพาะวงเงินจริง และให้ service เติมชื่อ/ผู้จัดทำ/ฝ่าย/ค่า budget compatibility อัตโนมัติ โดยคงประเภทวงเงิน / วิธีไว้เป็นช่องบังคับ

**Architecture:** เพิ่ม helper ฝั่ง `lib/projects` สำหรับชื่ออัตโนมัติและค่า budget ตาม category แล้วให้ `ProjectService.create` เป็นจุด normalize กลางทั้ง UI และ API ฟอร์มจะส่ง metadata ว่างและไม่ส่ง budget ที่ผู้ใช้กรอก ส่วน schema จะรองรับ input ใหม่โดยไม่เปลี่ยน Prisma หรือรูปแบบข้อมูลเก่า

**Tech Stack:** Next.js 16, React 19, TypeScript, Zod, Vitest, Testing Library, Prisma/Google Drive repositories

## Global Constraints

- ทำงานใน `C:\Users\ASUS\OneDrive\Documents\timeline` และ branch `master` โดยไม่สร้าง worktree
- คง `budgetCategory` และ `startDate` เป็น required
- ชื่ออัตโนมัติใช้รูปแบบ `Timeline-<รหัสสั้น 8 ตัว>-<DDMMYYYY>` และผู้จัดทำอัตโนมัติเป็น `-`
- ไม่เปลี่ยน Prisma schema, migration หรือข้อมูล Timeline เดิม
- แสดงชื่อโครงการ ผู้จัดทำ และฝ่ายแบบ optional; ซ่อนเฉพาะช่องวงเงินจริงในฟอร์มสร้าง และไม่ลบการแสดงวงเงินของรายการเก่าบน dashboard/detail

---

### Task 1: Lock the new normalization behavior with failing tests

**Files:**
- Modify: `tests/unit/project-service.test.ts`
- Modify: `tests/components/project-form.test.tsx`

**Interfaces:**
- Consumes: existing `ProjectService.create`, `ProjectForm`, `CreateProjectInput`
- Produces: regression tests for blank metadata, omitted budget, blank department, preserved explicit values, and the remaining visible form controls

- [ ] **Step 1: Replace the form test fixture with the new minimal form payload**

Update the test helper so it leaves the optional name/owner fields blank, selects department and budget category, and enters the start date. Add assertions that name/owner are present but optional and budget is absent:

```tsx
expect(screen.getByLabelText("ชื่อโครงการ")).not.toBeRequired();
expect(screen.getByLabelText("ผู้จัดทำ Timeline")).not.toBeRequired();
expect(screen.queryByLabelText("วงเงินจัดจ้าง (บาท)")).not.toBeInTheDocument();
expect(screen.getByLabelText("ประเภทวงเงิน / วิธี")).toBeRequired();
```

- [ ] **Step 2: Add a failing component test for submission without hidden fields**

Submit the form with department, category, start date, and note only. Assert the callback receives blank metadata and no budget:

```tsx
expect(onCreate).toHaveBeenCalledWith({
  name: "",
  ownerName: "",
  departmentName: expect.any(String),
  budgetCategory: "TEN_TO_TWENTY_MILLION",
  startDate: "2026-07-06",
  note: "โครงการทดสอบ",
});
```

- [ ] **Step 3: Add a failing service test for generated values**

Stub `globalThis.crypto.randomUUID` to a fixed UUID, call `service.create` with blank `name`, blank `ownerName`, and no `budget`, then assert:

```ts
expect(result.project.name).toBe("Timeline-A1B2C3D4-06072026");
expect(result.project.ownerName).toBe("-");
expect(result.project.budget).toBe(10_000_001);
```

- [ ] **Step 4: Add a failing service test that preserves explicit legacy values**

Call `service.create` with an explicit name, owner, and valid budget and assert those values remain unchanged.

- [ ] **Step 5: Run the focused tests and verify they fail for the intended missing behavior**

Run:

```bash
npm run test:run -- tests/components/project-form.test.tsx tests/unit/project-service.test.ts
```

Expected: failures show the old form still renders required hidden fields and the service rejects missing/blank metadata or budget. Do not change production code before observing this failure.

### Task 2: Implement shared automatic values and schema compatibility

**Files:**
- Create: `lib/projects/auto-values.ts`
- Modify: `lib/projects/schema.ts`
- Modify: `lib/projects/types.ts`
- Modify: `lib/projects/service.ts`
- Test: `tests/unit/project-service.test.ts`

**Interfaces:**
- Consumes: `BudgetCategory`, `isoDateSchema`, current project creation flow
- Produces: `defaultBudgetForCategory(category: BudgetCategory): number` and `generatedProjectName(startDate: string): string`; `ProjectService.create` persists normalized values

- [ ] **Step 1: Add the minimal normalization helpers**

Create `lib/projects/auto-values.ts` with these exact behaviors:

```ts
export function defaultBudgetForCategory(category: BudgetCategory): number {
  return {
    ONE_TO_FIVE_MILLION: 1_000_000,
    FIVE_TO_TEN_MILLION: 5_000_001,
    TEN_TO_TWENTY_MILLION: 10_000_001,
    ABOVE_TWENTY_MILLION: 50_000_001,
    SELECTIVE_METHOD: 1_000_000,
  }[category];
}

export function generatedProjectName(startDate: string): string {
  const [year, month, day] = startDate.split("-");
  const shortId = globalThis.crypto.randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
  return `Timeline-${shortId}-${day}${month}${year}`;
}
```

- [ ] **Step 2: Make only the new create inputs optional in Zod and TypeScript**

Change `CreateProjectInput.name`, `ownerName`, `departmentName`, and `budget` to optional. In `createProjectSchema`, default blank name/owner/department to `""`, make budget optional, and skip the category-vs-budget mismatch refinement when budget is omitted. Continue applying the existing minimum/range validation whenever a budget is supplied.

- [ ] **Step 3: Normalize inside `ProjectService.create`**

After parsing, derive values once and pass those values to the repository:

```ts
const name = parsed.name || generatedProjectName(parsed.startDate);
const ownerName = parsed.ownerName || "-";
const departmentName = parsed.departmentName || "-";
const budget = parsed.budget ?? defaultBudgetForCategory(parsed.budgetCategory);
```

Use `name`, `ownerName`, `departmentName`, and `budget` in the repository input. Keep template selection based on `parsed.budgetCategory`.

- [ ] **Step 4: Run the focused service tests and verify green**

Run:

```bash
npm run test:run -- tests/unit/project-service.test.ts
```

Expected: generated metadata, category-derived compatibility budgets, and explicit legacy values all pass.

### Task 3: Make metadata optional and remove only the budget input from the create form

**Files:**
- Modify: `components/dashboard/project-form.tsx`
- Modify: `tests/components/project-form.test.tsx`

**Interfaces:**
- Consumes: optional `CreateProjectInput` fields and existing category/date validation
- Produces: a form that visibly contains project name, optional department, budget category/method, optional owner, start date, note, and action buttons, without the budget input

- [ ] **Step 1: Remove budget parsing and client-side budget/category matching**

Delete the `budget` `FormData` read and `validateBudgetCategory` call. Keep optional `name` and `ownerName` reads, the weekend start-date guard, and submit blank strings when either optional input is left empty.

- [ ] **Step 2: Remove the JSX labels/inputs for name, budget, and owner**

Keep the name, owner, and department inputs visible without `required`; do not render the budget input. Keep the category selector with `required`, start date, note, and existing success/error flow.

- [ ] **Step 3: Run the focused component tests and verify green**

Run:

```bash
npm run test:run -- tests/components/project-form.test.tsx
```

Expected: the three fields are absent, category remains required, and submission succeeds without budget input.

### Task 4: Full verification and local run

**Files:**
- Modify: none unless verification reveals a regression

**Interfaces:**
- Consumes: all changes from Tasks 1–3
- Produces: verified local build/test state and a running local dev server

- [ ] **Step 1: Run the complete automated checks**

Run each command and inspect the exit code:

```bash
npm run test:run
npm run typecheck
npm run lint
npm run build:next
```

- [ ] **Step 2: Start the local dev server**

Run:

```bash
npm run dev
```

Keep the server running and verify the local app responds at `http://localhost:3000` using the available browser/local inspection workflow. Confirm the create modal no longer shows the three removed fields and still shows the category/method selector.

- [ ] **Step 3: Review the final diff and status**

Run:

```bash
git diff --check
git status --short
```

Confirm only intended source/test/plan files changed and report the local URL plus verification results.

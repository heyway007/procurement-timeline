# Dashboard Project Column Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the desktop dashboard action buttons in one row when a project name is long by allocating less table width to the project column, without adding `white-space: nowrap` or changing the mobile card layout.

**Architecture:** Keep the existing `ProjectTable` component and desktop/mobile markup. Add an explicit desktop table layout contract using `table-fixed`, a minimum table width for the existing horizontal scroller, and a `<colgroup>` that assigns 41% to the project column and 19% to the action column. Add a component regression assertion for these classes and leave the button text wrapping behavior unchanged.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS 4, Vitest, Testing Library.

## Global Constraints

- Do not use `white-space: nowrap` or Tailwind `whitespace-nowrap` on the “เปิด Timeline” links.
- Change only the desktop table sizing; preserve the existing mobile card layout.
- Work directly on `master` in `C:\Users\ASUS\OneDrive\Documents\timeline`.
- Do not deploy or publish production assets.

---

### Task 1: Add the failing regression assertion

**Files:**
- Modify: `tests/components/dashboard.test.tsx`

**Interfaces:**
- Consumes: `Dashboard` and the existing `projects` fixture.
- Produces: A regression check requiring the desktop table sizing contract.

- [ ] **Step 1: Add a test that requires fixed table sizing and explicit project/action widths**

Add this test inside `describe("Dashboard", () => { ... })`:

```tsx
  it("allocates less desktop table width to long project names", () => {
    render(<Dashboard initialProjects={projects} />);

    const table = screen.getByRole("table");
    const projectHeader = screen.getByRole("columnheader", { name: "โครงการ" });
    const actionHeader = screen.getByRole("columnheader", { name: "เปิด" });

    expect(table).toHaveClass("table-fixed", "min-w-[1100px]");
    expect(projectHeader).toHaveClass("w-[41%]");
    expect(actionHeader).toHaveClass("w-[19%]");
    expect(screen.getAllByRole("link", { name: /เปิด Timeline/ })[0]).not.toHaveClass("whitespace-nowrap");
  });
```

- [ ] **Step 2: Run the focused test and verify it fails for the missing layout contract**

Run:

```powershell
npm run test:run -- tests/components/dashboard.test.tsx
```

Expected: the existing dashboard tests pass, and the new test fails because the desktop table does not yet have `table-fixed`, `min-w-[1100px]`, or the explicit column width classes.

### Task 2: Implement the desktop column sizing

**Files:**
- Modify: `components/dashboard/project-table.tsx`

**Interfaces:**
- Consumes: Existing `ProjectTable` project rows and responsive markup.
- Produces: Desktop table with a bounded project column and a wider action column.

- [ ] **Step 1: Make the desktop table use a fixed layout with enough scrollable width**

Change the desktop table wrapper and table opening tags to:

```tsx
      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-[1100px] table-fixed divide-y divide-slate-200">
          <colgroup>
            <col className="w-[41%]" />
            <col className="w-[16%]" />
            <col className="w-[12%]" />
            <col className="w-[12%]" />
            <col className="w-[19%]" />
          </colgroup>
```

Keep the existing five table columns in the same order. The first `<col>` limits the project column so long names wrap inside it; the last `<col>` reserves enough room for both action controls. Do not add `whitespace-nowrap` to either “เปิด Timeline” link.

- [ ] **Step 2: Add matching width classes to the project and action headers**

Change the first and last `<th>` elements to:

```tsx
              <th className="w-[41%] px-5 py-4">โครงการ</th>
```

and:

```tsx
              <th className="w-[19%] px-5 py-4"><span className="sr-only">เปิด</span></th>
```

Leave the row content, link classes, and mobile markup unchanged.

- [ ] **Step 3: Run the focused test and verify it passes**

Run:

```powershell
npm run test:run -- tests/components/dashboard.test.tsx
```

Expected: all dashboard tests pass, including the long-name layout regression assertion.

- [ ] **Step 4: Review the diff for the forbidden approach**

Run:

```powershell
git diff -- components/dashboard/project-table.tsx tests/components/dashboard.test.tsx
rg -n "whitespace-nowrap|white-space:\s*nowrap" components/dashboard/project-table.tsx tests/components/dashboard.test.tsx
```

Expected: no `nowrap` match is added to the changed component or test.

### Task 3: Run project verification and local server check

**Files:**
- No additional files; verify the changes from Tasks 1–2.

**Interfaces:**
- Consumes: Updated `ProjectTable` and dashboard regression test.
- Produces: Evidence that the fix passes automated checks and runs locally without production deployment.

- [ ] **Step 1: Run the complete automated checks**

Run:

```powershell
npm run test:run
npm run typecheck
npm run lint
npm run build
```

Expected: each command exits with code 0. The build is only a local verification build; do not run deployment or publish commands.

- [ ] **Step 2: Start the local development server**

Run:

```powershell
npm run dev
```

Expected: Next.js reports a local URL, normally `http://localhost:3000`.

- [ ] **Step 3: Inspect the dashboard locally at desktop width**

Open the local URL and verify a long project name wraps inside the narrower “โครงการ” column while the “เปิด Timeline” and delete controls stay in the right-side action column on one row. Resize below the desktop breakpoint and verify the mobile card layout remains unchanged.

- [ ] **Step 4: Check final repository state**

Run:

```powershell
git diff --check
git status --short
```

Expected: no whitespace errors; only the intended component and test changes remain unstaged unless the user requests a commit.

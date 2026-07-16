# Print Preview Options Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ปลดล็อกตัวเลือก Print Preview ของ Chrome โดยไม่บังคับขนาดกระดาษ แนวกระดาษ หรือขอบกระดาษจากหน้า Timeline

**Architecture:** แก้เฉพาะ print stylesheet ใน `app/globals.css` โดยลบกฎ `@page` ที่กำหนดค่าตายตัว และเพิ่ม regression test ที่อ่าน stylesheet เพื่อป้องกันไม่ให้ค่าดังกล่าวกลับมาอีก การจัด layout, ปุ่มพิมพ์ และ data flow จะไม่เปลี่ยน

**Tech Stack:** Next.js, React, TypeScript, CSS, Vitest, Testing Library, ESLint

## Global Constraints

- ให้ Chrome เป็นผู้จัดการตัวเลือก destination, pages, layout, paper size, margins, scale, headers/footers และ Save as PDF
- คง layout ตารางและการจัดรูปแบบสำหรับการพิมพ์ที่มีอยู่
- คงการซ่อนปุ่ม/ส่วนควบคุมที่ไม่ควรอยู่ในเอกสารพิมพ์
- ไม่เพิ่มเมนูพิมพ์แบบกำหนดเองในหน้าเว็บในรอบนี้
- ทำงานบน `master` โดยตรง และไม่สร้าง worktree

---

### Task 1: Add a regression test for unlocked print settings

**Files:**
- Create: `tests/unit/print-styles.test.ts`

**Interfaces:**
- Consumes: `app/globals.css` as the source print stylesheet
- Produces: A failing regression test proving the stylesheet must not contain a print `@page` rule

- [ ] **Step 1: Write the failing test**

Create `tests/unit/print-styles.test.ts` with:

```ts
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = fs.readFileSync(
  path.resolve(process.cwd(), "app/globals.css"),
  "utf8",
);

describe("print stylesheet", () => {
  it("does not lock browser print settings with an @page rule", () => {
    expect(stylesheet).not.toMatch(/@page\s*\{/);
    expect(stylesheet).not.toMatch(/size:\s*A4\s+landscape/);
    expect(stylesheet).not.toMatch(/margin:\s*8mm/);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails for the expected reason**

Run:

```powershell
npx vitest run tests/unit/print-styles.test.ts
```

Expected: FAIL because `app/globals.css` currently contains `@page { size: A4 landscape; margin: 8mm; }`.

### Task 2: Remove the fixed print-page settings

**Files:**
- Modify: `app/globals.css:129-133`

**Interfaces:**
- Consumes: The failing regression test from Task 1
- Produces: A print stylesheet whose page settings are controlled by Chrome Print Preview

- [ ] **Step 1: Remove only the fixed `@page` block**

Delete this block from the start of `@media print`:

```css
  @page {
    size: A4 landscape;
    margin: 8mm;
  }
```

Do not modify the remaining print rules for `.print-page`, `.print-grid`, `.print-hidden`, typography, table borders, or page breaks.

- [ ] **Step 2: Run the regression test to verify it passes**

Run:

```powershell
npx vitest run tests/unit/print-styles.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run the complete verification suite**

Run:

```powershell
npm run test:run
npx eslint app components lib tests --quiet
git diff --check
```

Expected: 18 test files and 121 tests pass (the existing 120 plus the new regression test), ESLint exits 0, and `git diff --check` reports no whitespace errors.

- [ ] **Step 4: Verify the local server responds**

Run:

```powershell
$response = Invoke-WebRequest -UseBasicParsing http://localhost:3000 -TimeoutSec 10
"HTTP $($response.StatusCode)"
```

Expected: `HTTP 200`. Open the Timeline page and confirm that both the print button and `Ctrl+P` still open the browser print flow with the existing Timeline content.

- [ ] **Step 5: Commit the implementation**

Run:

```powershell
git add app/globals.css tests/unit/print-styles.test.ts
git commit -m "fix: unlock browser print preview options"
```

Expected: A new commit on `master` containing only the print stylesheet change and its regression test.

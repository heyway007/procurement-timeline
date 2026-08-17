# Responsive Timeline Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ทำให้ตารางรายละเอียด Timeline แสดง 4 คอลัมน์เหมือน Desktop บนมือถือโดยไม่เกิด horizontal scroll

**Architecture:** ปรับเฉพาะ Tailwind classes ใน `TimelineDetail` ให้ header และ rows ใช้ responsive grid ตั้งแต่ทุก breakpoint พร้อมลดขนาด/อนุญาตตัดบรรทัดบนจอเล็ก ส่วน logic และ print classes เดิมยังคงอยู่

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest, Testing Library

## Global Constraints

- ไม่เปลี่ยน API, model, schedule calculation หรือข้อมูลโครงการ
- ต้องคง print layout เดิมที่ใช้ `print-grid`, `print-hidden` และ `print-only`
- ต้องไม่มี horizontal scrollbar จากตารางบนหน้าจอมือถือ

---

### Task 1: Add responsive layout regression test

**Files:**
- Modify: `tests/components/timeline-editor.test.tsx` รอบ test `marks timeline rows for print table layout`

- [ ] **Step 1: Write the failing test**

เพิ่ม assertion ให้ header แสดงผลและ row ใช้ mobile 4-column grid:

```tsx
it("keeps the timeline table as four columns on small screens", () => {
  render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

  expect(screen.getByTestId("timeline-header-row")).toHaveClass("grid");
  expect(screen.getByTestId("timeline-header-row")).not.toHaveClass("hidden");
  expect(screen.getAllByTestId("timeline-step")[0]).toHaveClass(
    "grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1.15fr)_3.5rem]",
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- tests/components/timeline-editor.test.tsx`

Expected: FAIL because the current header has `hidden` and rows have no base responsive grid columns.

### Task 2: Implement responsive four-column table

**Files:**
- Modify: `components/timeline/timeline-detail.tsx:504-546`

- [ ] **Step 1: Write minimal implementation**

ใช้แนวทางนี้กับ table header, step rows และ ending row:

```tsx
className="print-grid grid grid-cols-[1.75rem_minmax(0,1fr)_minmax(0,1.15fr)_3.5rem] gap-2 px-2 py-3 text-xs sm:grid-cols-[2.5rem_minmax(0,1.4fr)_minmax(0,1.2fr)_6rem] sm:gap-3 sm:px-4 sm:py-4 sm:text-base lg:grid-cols-[4rem_1fr_20rem_7rem]"
```

ปรับ title/subtitle/date/button ให้ย่อได้บนมือถือ และลบ label “วันที่กำหนด” ที่ซ้ำกับหัวตารางเฉพาะ mobile โดยไม่ลบข้อมูลจริง

- [ ] **Step 2: Run focused test**

Run: `npm run test:run -- tests/components/timeline-editor.test.tsx`

Expected: PASS.

### Task 3: Verify the responsive detail page

**Files:**
- No additional files

- [ ] **Step 1: Run full automated verification**

Run: `npm run test:run`

Run: `npm run typecheck`

Run: `npx eslint components/timeline/timeline-detail.tsx tests/components/timeline-editor.test.tsx`

- [ ] **Step 2: Run local browser verification**

เปิดหน้า local project detail ตรวจที่ desktop และ viewport มือถือว่า header ตารางยังแสดง 4 คอลัมน์, เนื้อหาไม่ล้นด้านขวา และปุ่มแก้วันที่ยังอยู่ครบ

- [ ] **Step 3: Check diff**

Run: `git diff --check`

ยืนยันว่าไม่มีการ stage ไฟล์ debug logs, `next-env.d.ts` หรือการเปลี่ยนแปลง unrelated

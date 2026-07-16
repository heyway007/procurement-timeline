# Step 1 Heading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แสดงขั้นตอนที่ 1 เป็นหัวข้อ `จัดทำเอกสาร` และรายละเอียดบรรทัดเล็กที่คั่นด้วย `•` โดยไม่เปลี่ยนขั้นตอนอื่นหรือข้อมูลกำหนดการ

**Architecture:** ปรับเฉพาะ rendering branch ของแถวลำดับ 1 ใน `TimelineDetail` และเก็บ label ต้นฉบับไว้เหมือนเดิมเพื่อหลีกเลี่ยง migration ข้อมูล ขั้นตอนอื่นยังเรียก `displayStepLabel` ตามเดิม

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library

## Global Constraints

- ใช้กับขั้นตอนที่มี `order` เท่ากับ 1 ในทุกประเภทวงเงิน
- หัวข้อหลักต้องเป็น `จัดทำเอกสาร`
- รายละเอียดต้องเป็น `รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา`
- รายละเอียดต้องอยู่บรรทัดถัดไป มีขนาดเล็กกว่าและใช้สีรอง
- หน้าเว็บและงานพิมพ์ต้องแสดงข้อความใหม่ครบ
- ห้ามเปลี่ยน label ที่จัดเก็บ วันที่ ระยะเวลา ลำดับขั้น หรือขั้นตอนอื่น

---

### Task 1: Step 1 Visual Hierarchy

**Files:**
- Modify: `components/timeline/timeline-detail.tsx:410-418`
- Test: `tests/components/timeline-editor.test.tsx`

**Interfaces:**
- Consumes: `ProjectRecord["steps"][number].order` และ rendering loop เดิมของ `TimelineDetail`
- Produces: JSX สำหรับขั้นตอนที่ 1 ที่มีหัวข้อและรายละเอียดแยก element; ไม่เพิ่ม API หรือ persisted field

- [ ] **Step 1: Write the failing component tests**

เพิ่มเทสต์ต่อไปนี้ใน `tests/components/timeline-editor.test.tsx`:

```tsx
it("renders step one with a heading and smaller bullet-separated detail", () => {
  render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

  const firstRow = screen.getAllByTestId("timeline-step")[0];
  const heading = within(firstRow).getByText("จัดทำเอกสาร");
  const detail = within(firstRow).getByText(
    "รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา",
  );

  expect(heading).toHaveClass("text-lg", "font-semibold");
  expect(detail).toHaveClass("text-sm", "text-slate-500");
  expect(detail).not.toHaveClass("print-hidden");
});

it("does not replace the wording of later steps", () => {
  render(<TimelineDetail projectId="project-1" initialProject={projectFixture()} />);

  const secondRow = screen.getAllByTestId("timeline-step")[1];
  expect(secondRow).toHaveTextContent(
    "ประกาศร่างประกาศและเอกสารประกวดราคาเพื่อรับฟังคำวิจารณ์",
  );
  expect(within(secondRow).queryByText("จัดทำเอกสาร")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify red state**

Run:

```powershell
npx vitest run tests/components/timeline-editor.test.tsx
```

Expected: FAIL because `จัดทำเอกสาร` และรายละเอียดแบบใหม่ยังไม่มีในขั้นตอนที่ 1

- [ ] **Step 3: Implement the step-one rendering branch**

แทนที่ paragraph แสดง label ใน rendering loop ของ `components/timeline/timeline-detail.tsx` ด้วย:

```tsx
{step.order === 1 ? (
  <>
    <p className="text-lg font-semibold text-slate-900">จัดทำเอกสาร</p>
    <p className="mt-1 text-sm text-slate-500">
      รายงานขอซื้อขอจ้าง • แต่งตั้งคณะกรรมการ • ประกวดราคา
    </p>
  </>
) : (
  <p className="font-medium text-slate-900">{displayStepLabel(step)}</p>
)}
```

คง paragraph ของคำอธิบายวันทำการและ branch ของขั้นเสนอราคาไว้หลัง JSX นี้ตามเดิม

- [ ] **Step 4: Run the focused tests and verify green state**

Run:

```powershell
npx vitest run tests/components/timeline-editor.test.tsx
```

Expected: PASS ทุกเทสต์ในไฟล์

- [ ] **Step 5: Run regression verification**

Run:

```powershell
npx vitest run --exclude tests/components/dashboard.test.tsx
npm run typecheck
npx eslint components/timeline/timeline-detail.tsx tests/components/timeline-editor.test.tsx
git diff --check
npm run build
```

Expected: 113+ tests pass, typecheck/lint/diff check exit 0, production build succeeds. Dashboard test exclusion remains the known responsive duplicate-markup baseline.

- [ ] **Step 6: Commit the implementation**

```powershell
git add components/timeline/timeline-detail.tsx tests/components/timeline-editor.test.tsx
git commit -m "feat: format step one as document heading"
```

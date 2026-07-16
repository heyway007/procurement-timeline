# Print Detail Font Size Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** เพิ่มขนาดเฉพาะข้อความรายละเอียดของ Timeline ในเอกสารที่พิมพ์ให้เป็น 18px โดยไม่เปลี่ยนขนาดหัวข้อหรือหน้าจอปกติ

**Architecture:** ใช้ CSS override ภายใน `@media print` ที่มีอยู่ใน `app/globals.css` โดยแยก selector ของข้อความรายละเอียดออกจาก selector ของหัวข้อ `.text-lg` และไม่แตะโครงสร้าง JSX หรือข้อมูล Timeline

**Tech Stack:** Next.js, React, Tailwind utility classes, CSS print media query, Vitest

## Global Constraints

- แก้เฉพาะ `app/globals.css`
- ไม่เปลี่ยนขนาด `.print-header h1`, ชื่อขั้นตอน `.text-lg` หรือหัวตาราง
- ไม่เปลี่ยนโครงสร้างตาราง กระดาษ A4 แนวนอน หรือข้อมูล Timeline
- ตรวจสอบด้วย lint และ test ที่เกี่ยวข้อง พร้อมรัน local เพื่อยืนยันว่าแอปเปิดได้

---

### Task 1: Increase print-only detail text

**Files:**
- Modify: `app/globals.css:176-232`
- Test: `tests/components/timeline-editor.test.tsx` (existing print behavior regression suite)

**Interfaces:**
- Consumes: Existing `.print-grid` markup, including subtitle paragraphs and date/detail text.
- Produces: Print CSS where detail paragraphs render at 18px while heading selectors retain their current sizes.

- [ ] **Step 1: Capture the current print CSS behavior**

Run:

```powershell
rg -n -C 3 "\.print-header h1|\.print-grid|\.print-grid \.text-lg|font-size" app/globals.css
```

Expected: `.print-grid` and `.print-grid .text-lg` are both currently set to 16px, while `.print-header h1` is 22px.

- [ ] **Step 2: Update only detail selectors**

In `app/globals.css`, keep `.print-grid` and `.print-grid .text-lg` unchanged so headings remain the same size, then add a print-only rule after them:

```css
  .print-grid p:not(.text-lg) {
    font-size: 18px !important;
    line-height: 1.35 !important;
  }
```

This targets the subtitle and other paragraph details, without changing the title paragraph that has the `text-lg` class.

- [ ] **Step 3: Verify the CSS diff and lint**

Run:

```powershell
git diff --check
npm run lint
```

Expected: no whitespace errors and lint exits with code 0.

- [ ] **Step 4: Run the focused regression tests**

Run:

```powershell
npx vitest run tests/components/timeline-editor.test.tsx
```

Expected: all timeline editor tests pass, including the existing `prints the timeline` test.

- [ ] **Step 5: Start local and verify the app responds**

Run:

```powershell
npm run dev
```

Open `http://localhost:3000` and confirm the Timeline page loads. Use the browser print preview or print emulation to confirm detail text is larger while titles remain unchanged.

- [ ] **Step 6: Commit the implementation**

```powershell
git add app/globals.css docs/superpowers/plans/2026-07-16-print-detail-font-size.md
git commit -m "fix: enlarge timeline print details"
```

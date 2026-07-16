# Timeline Title and Subtitle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** แสดงข้อความขั้นตอนจัดซื้อจัดจ้างเป็น title และ subtitle ตามเอกสาร Google Docs โดยไม่แก้ persisted data

**Architecture:** เพิ่ม pure presentation helper ใน `TimelineDetail` ที่รับ milestone แล้วคืน `{ title, subtitle? }` จาก semantic label เดิม จากนั้น renderer ใช้โครงสร้างเดียวกันทุกแถว ทำให้รองรับโครงการเดิมโดยไม่ migration

**Tech Stack:** React, TypeScript, Tailwind CSS, Vitest, Testing Library

## Global Constraints

- ข้อความต้องตรงกับแท็บ “ข้อความ ขั้นตอน”
- ไม่เปลี่ยนวันที่ ระยะเวลา SLA หรือลำดับขั้นตอน
- ไม่ commit และไม่ push Git

---

### Task 1: Timeline Step Presentation

**Files:**
- Modify: `components/timeline/timeline-detail.tsx`
- Modify: `lib/schedule/milestone-kind.ts`
- Test: `tests/components/timeline-editor.test.tsx`

**Interfaces:**
- Consumes: `ProjectRecord["steps"][number]`
- Produces: `{ title: string; subtitle?: string }` สำหรับ renderer

- [ ] **Step 1: Write failing component tests**

เพิ่ม assertions สำหรับ title/subtitle ของขั้นตอนร่างประกวดราคา, ประกาศประกวดราคา, ขอรับเอกสาร, เสนอราคา, Present, รายงานผล, ประกาศผู้ชนะ และอุทธรณ์ รวมทั้ง mapping ของวงเงินเล็กและช่วงเวลาเสนอราคา 9.00–12.00 / 13.00–16.30 น.

- [ ] **Step 2: Verify red state**

Run: `npx vitest run tests/components/timeline-editor.test.tsx`

Expected: FAIL เพราะขั้นตอนที่ 2 เป็นต้นไปยังแสดง label เดิมเป็นบรรทัดเดียว

- [ ] **Step 3: Implement the presentation helper and shared renderer**

เพิ่ม helper ที่ map semantic label เป็น title/subtitle ตามเอกสาร และแทน conditional ของขั้นตอนที่ 1 ด้วย renderer เดียวกันทุกแถว

- [ ] **Step 4: Verify green state**

Run: `npx vitest run tests/components/timeline-editor.test.tsx`

Expected: PASS ทุก test ในไฟล์

- [ ] **Step 5: Regression verification**

Run:

```powershell
npm run typecheck
npx eslint components/timeline/timeline-detail.tsx tests/components/timeline-editor.test.tsx
git diff --check
npm run build
```

Expected: ทุกคำสั่ง exit 0

# Procurement Timeline Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a cloud-ready Thai procurement scheduling web app that calculates a shared 13-step timeline over Thai government working days and supports controlled milestone replanning.

**Architecture:** Use a Next.js App Router full-stack application with a pure TypeScript schedule engine, Prisma ORM 7, and PostgreSQL. UI and route handlers depend on service interfaces; the schedule engine has no framework or database dependency. Persist a snapshot of template steps per project, use optimistic project versions, and treat holiday changes as preview/confirm operations.

**Tech Stack:** Node.js 24, npm, Next.js App Router, React, TypeScript, Tailwind CSS, Zod, Prisma ORM 7 with `@prisma/adapter-pg`, PostgreSQL, Vitest, Testing Library, and Playwright.

## Global Constraints

- Use Node.js `>=24.0.0 <25` and npm.
- Store schedule and holiday values as PostgreSQL `DATE`; exchange them as ISO `YYYY-MM-DD` strings.
- Display dates in Thai locale with Buddhist Era while all calculations use ISO dates and `Asia/Bangkok` semantics.
- The selected project start date is milestone 1; Monday plus 4 working-day additions produces Friday.
- Exclude Saturdays, Sundays, and configured organizational holidays.
- Reject weekend or holiday project starts and manual milestone dates; never auto-shift user input.
- Persist the 13 visible, non-redacted template rows from the approved design; their outgoing durations sum to 37 working-day additions.
- All projects snapshot their template labels and durations at creation.
- A manual milestone edit preserves earlier dates, clears later manual edits after confirmation, and recalculates later milestones from template durations.
- No authentication or progress tracking in this release; anyone with the URL can read and mutate data.
- Use Thai validation and conflict messages; destructive and schedule-overwriting actions require confirmation.
- Do not provision a cloud database automatically. Read `DATABASE_URL` and `TEST_DATABASE_URL` from environment variables.

---

## File Map

- `package.json` — commands and dependency boundaries.
- `app/layout.tsx`, `app/globals.css` — Thai shell, responsive design tokens, print rules, and `noindex` metadata.
- `app/page.tsx`, `components/dashboard/*` — shared project dashboard and create form.
- `app/projects/[id]/page.tsx`, `components/timeline/*` — project summary, milestone editor, reset, deletion, and print view.
- `app/holidays/page.tsx`, `components/holidays/*` — calendar-year verification and holiday preview/confirm UI.
- `app/api/projects/**/route.ts`, `app/api/holidays/**/route.ts` — JSON HTTP boundary.
- `lib/schedule/date.ts` — timezone-independent ISO date operations.
- `lib/schedule/engine.ts` — pure working-day schedule calculations.
- `lib/schedule/types.ts` — template, milestone, and timeline contracts.
- `lib/projects/schema.ts`, `lib/projects/service.ts`, `lib/projects/repository.ts` — project validation and use cases.
- `lib/holidays/schema.ts`, `lib/holidays/service.ts`, `lib/holidays/repository.ts` — holiday validation, impact preview, and confirmation.
- `lib/db/prisma.ts`, `lib/db/prisma-project-repository.ts`, `lib/db/prisma-holiday-repository.ts` — Prisma adapters.
- `prisma/schema.prisma`, `prisma/seed.ts`, `prisma.config.ts` — database schema, approved template seed, and migrations.
- `tests/unit/*`, `tests/integration/*`, `tests/components/*`, `tests/e2e/*` — test layers.

---

### Task 1: Application Shell and Test Harness

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.ts`
- Create: `postcss.config.mjs`
- Create: `eslint.config.mjs`
- Create: `vitest.config.ts`
- Create: `tests/setup.ts`
- Create: `app/layout.tsx`
- Create: `app/page.tsx`
- Create: `app/globals.css`
- Create: `.env.example`
- Create: `.gitignore`
- Test: `tests/components/app-shell.test.tsx`

**Interfaces:**
- Consumes: approved design only.
- Produces: npm scripts `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `test:run`, `test:e2e`, `prisma:generate`, `prisma:migrate`, and import alias `@/*`.

- [ ] **Step 1: Create the dependency manifest and compiler configuration**

Use this `package.json` shape and install the resolved versions into `package-lock.json`:

```json
{
  "name": "procurement-timeline-management",
  "version": "0.1.0",
  "private": true,
  "engines": { "node": ">=24.0.0 <25" },
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest",
    "test:run": "vitest run",
    "test:e2e": "playwright test",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "postinstall": "prisma generate"
  }
}
```

Run:

```powershell
npm install --ignore-scripts next@latest react@latest react-dom@latest zod clsx @prisma/client@^7 @prisma/adapter-pg pg dotenv
npm install --ignore-scripts -D typescript @types/node @types/react @types/react-dom @types/pg eslint eslint-config-next tailwindcss @tailwindcss/postcss vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event prisma@^7 tsx @playwright/test
```

Expected: dependencies install successfully and `package-lock.json` is created.

- [ ] **Step 2: Write the failing shell test**

```tsx
// tests/components/app-shell.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HomePage from "@/app/page";

describe("application shell", () => {
  it("renders the Thai product title and create action", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading", { name: "แผนงานจัดซื้อจัดจ้าง" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "สร้าง Timeline" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run the shell test and verify the red state**

Run: `npm run test:run -- tests/components/app-shell.test.tsx`

Expected: FAIL because `app/page.tsx` and the test environment do not exist yet.

- [ ] **Step 4: Create the minimal tested shell**

```tsx
// app/page.tsx
export default function HomePage() {
  return (
    <main className="mx-auto min-h-screen max-w-7xl px-4 py-8 sm:px-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-indigo-700">Procurement Timeline</p>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">แผนงานจัดซื้อจัดจ้าง</h1>
        </div>
        <button className="rounded-xl bg-indigo-700 px-4 py-3 font-medium text-white">สร้าง Timeline</button>
      </header>
    </main>
  );
}
```

Configure Vitest with `jsdom`, alias `@` to the repository root, and `setupFiles: ["./tests/setup.ts"]`; import `@testing-library/jest-dom/vitest` from `tests/setup.ts`. Set root metadata in `app/layout.tsx` to Thai, `robots: { index: false, follow: false }`, and import `app/globals.css`.

- [ ] **Step 5: Verify the shell**

Run: `npm run test:run -- tests/components/app-shell.test.tsx`

Expected: 1 test passes.

Run: `npm run lint && npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 6: Commit the shell**

```powershell
git add package.json package-lock.json tsconfig.json next.config.ts postcss.config.mjs eslint.config.mjs vitest.config.ts tests/setup.ts tests/components/app-shell.test.tsx app .env.example .gitignore
git commit -m "chore: scaffold timeline web application"
```

---

### Task 2: Pure Working-Day Schedule Engine

**Files:**
- Create: `lib/schedule/types.ts`
- Create: `lib/schedule/date.ts`
- Create: `lib/schedule/engine.ts`
- Test: `tests/unit/schedule-date.test.ts`
- Test: `tests/unit/schedule-engine.test.ts`

**Interfaces:**
- Consumes: ISO date strings and a `ReadonlySet<string>` of holidays.
- Produces: `addWorkingDays`, `countWorkingDayAdditions`, `buildTimeline`, `adjustMilestone`, and `adjustProcessEnd`.

- [ ] **Step 1: Write failing ISO date tests**

```ts
// tests/unit/schedule-date.test.ts
import { describe, expect, it } from "vitest";
import { addWorkingDays, countWorkingDayAdditions, isWorkingDay } from "@/lib/schedule/date";

const holidays = new Set(["2026-07-28"]);

describe("working-day date math", () => {
  it("adds four working days from Monday to Friday", () => {
    expect(addWorkingDays("2026-07-06", 4, new Set())).toBe("2026-07-10");
  });

  it("skips weekends and configured holidays", () => {
    expect(addWorkingDays("2026-07-24", 2, holidays)).toBe("2026-07-29");
  });

  it("counts additions excluding the starting date", () => {
    expect(countWorkingDayAdditions("2026-07-06", "2026-07-14", new Set())).toBe(6);
  });

  it("rejects a configured holiday as a working day", () => {
    expect(isWorkingDay("2026-07-28", holidays)).toBe(false);
  });
});
```

- [ ] **Step 2: Run date tests to verify failure**

Run: `npm run test:run -- tests/unit/schedule-date.test.ts`

Expected: FAIL with unresolved `@/lib/schedule/date`.

- [ ] **Step 3: Implement timezone-independent date math**

```ts
// lib/schedule/date.ts
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function parseIsoDate(value: string): Date {
  if (!ISO_DATE.test(value)) throw new Error("INVALID_ISO_DATE");
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.toISOString().slice(0, 10) !== value) throw new Error("INVALID_ISO_DATE");
  return date;
}

function formatIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function plusCalendarDay(value: string, amount: number): string {
  const date = parseIsoDate(value);
  date.setUTCDate(date.getUTCDate() + amount);
  return formatIsoDate(date);
}

export function isWorkingDay(value: string, holidays: ReadonlySet<string>): boolean {
  const day = parseIsoDate(value).getUTCDay();
  return day !== 0 && day !== 6 && !holidays.has(value);
}

export function addWorkingDays(value: string, amount: number, holidays: ReadonlySet<string>): string {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("INVALID_WORKING_DAY_AMOUNT");
  let cursor = value;
  let additions = 0;
  while (additions < amount) {
    cursor = plusCalendarDay(cursor, 1);
    if (isWorkingDay(cursor, holidays)) additions += 1;
  }
  return cursor;
}

export function countWorkingDayAdditions(from: string, to: string, holidays: ReadonlySet<string>): number {
  if (to <= from) throw new Error("DATE_MUST_BE_AFTER_PREVIOUS");
  let cursor = from;
  let additions = 0;
  while (cursor < to) {
    cursor = plusCalendarDay(cursor, 1);
    if (isWorkingDay(cursor, holidays)) additions += 1;
  }
  if (cursor !== to || !isWorkingDay(to, holidays)) throw new Error("DATE_MUST_BE_WORKING_DAY");
  return additions;
}
```

- [ ] **Step 4: Verify date tests pass**

Run: `npm run test:run -- tests/unit/schedule-date.test.ts`

Expected: 4 tests pass.

- [ ] **Step 5: Write failing timeline and replanning tests**

```ts
// tests/unit/schedule-engine.test.ts
import { describe, expect, it } from "vitest";
import { adjustMilestone, adjustProcessEnd, buildTimeline } from "@/lib/schedule/engine";
import type { TemplateStep } from "@/lib/schedule/types";

const template: TemplateStep[] = [
  { order: 1, label: "ขั้นตอน 1", workingDaysToNext: 4 },
  { order: 2, label: "ขั้นตอน 2", workingDaysToNext: 1 },
  { order: 3, label: "ขั้นตอน 3", workingDaysToNext: 7 }
];

describe("schedule engine", () => {
  it("uses the project start as milestone one and adds template durations", () => {
    const result = buildTimeline(template, "2026-07-06", new Set());
    expect(result.milestones.map((item) => item.scheduledDate)).toEqual([
      "2026-07-06", "2026-07-10", "2026-07-13"
    ]);
    expect(result.processEndDate).toBe("2026-07-22");
  });

  it("changes one milestone, clears later overrides, and recalculates forward", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    const changed = adjustMilestone(base, 2, "2026-07-14", new Set());
    expect(changed.milestones[0].scheduledDate).toBe("2026-07-06");
    expect(changed.milestones[1]).toMatchObject({ scheduledDate: "2026-07-14", isDateManuallyAdjusted: true });
    expect(changed.milestones[2]).toMatchObject({ scheduledDate: "2026-07-15", isDateManuallyAdjusted: false });
  });

  it("allows the final process end milestone to change", () => {
    const base = buildTimeline(template, "2026-07-06", new Set());
    expect(adjustProcessEnd(base, "2026-07-24", new Set()).processEndDate).toBe("2026-07-24");
  });
});
```

- [ ] **Step 6: Implement timeline contracts and engine**

```ts
// lib/schedule/types.ts
export type TemplateStep = { order: number; label: string; workingDaysToNext: number };
export type ScheduledMilestone = TemplateStep & { scheduledDate: string; isDateManuallyAdjusted: boolean };
export type ScheduledTimeline = {
  milestones: ScheduledMilestone[];
  processEndDate: string;
  isProcessEndManuallyAdjusted: boolean;
};
```

```ts
// lib/schedule/engine.ts
import { addWorkingDays, countWorkingDayAdditions, isWorkingDay } from "./date";
import type { ScheduledTimeline, TemplateStep } from "./types";

export function buildTimeline(template: TemplateStep[], startDate: string, holidays: ReadonlySet<string>): ScheduledTimeline {
  if (template.length === 0) throw new Error("TEMPLATE_EMPTY");
  if (!isWorkingDay(startDate, holidays)) throw new Error("START_DATE_MUST_BE_WORKING_DAY");
  const milestones = template.map((step, index) => ({
    ...step,
    scheduledDate: index === 0 ? startDate : "",
    isDateManuallyAdjusted: false
  }));
  for (let index = 1; index < milestones.length; index += 1) {
    const previous = milestones[index - 1];
    milestones[index].scheduledDate = addWorkingDays(previous.scheduledDate, previous.workingDaysToNext, holidays);
  }
  const last = milestones[milestones.length - 1];
  return {
    milestones,
    processEndDate: addWorkingDays(last.scheduledDate, last.workingDaysToNext, holidays),
    isProcessEndManuallyAdjusted: false
  };
}

export function adjustMilestone(timeline: ScheduledTimeline, order: number, newDate: string, holidays: ReadonlySet<string>): ScheduledTimeline {
  const index = timeline.milestones.findIndex((item) => item.order === order);
  if (index < 0) throw new Error("MILESTONE_NOT_FOUND");
  if (!isWorkingDay(newDate, holidays)) throw new Error("DATE_MUST_BE_WORKING_DAY");
  if (index === 0) return buildTimeline(timeline.milestones, newDate, holidays);
  countWorkingDayAdditions(timeline.milestones[index - 1].scheduledDate, newDate, holidays);
  const milestones = timeline.milestones.map((item) => ({ ...item }));
  milestones[index].scheduledDate = newDate;
  milestones[index].isDateManuallyAdjusted = true;
  for (let cursor = index + 1; cursor < milestones.length; cursor += 1) {
    const previous = milestones[cursor - 1];
    milestones[cursor].scheduledDate = addWorkingDays(previous.scheduledDate, previous.workingDaysToNext, holidays);
    milestones[cursor].isDateManuallyAdjusted = false;
  }
  const last = milestones[milestones.length - 1];
  return {
    milestones,
    processEndDate: addWorkingDays(last.scheduledDate, last.workingDaysToNext, holidays),
    isProcessEndManuallyAdjusted: false
  };
}

export function adjustProcessEnd(timeline: ScheduledTimeline, newDate: string, holidays: ReadonlySet<string>): ScheduledTimeline {
  const last = timeline.milestones[timeline.milestones.length - 1];
  countWorkingDayAdditions(last.scheduledDate, newDate, holidays);
  return { ...timeline, processEndDate: newDate, isProcessEndManuallyAdjusted: true };
}
```

- [ ] **Step 7: Verify engine and boundary cases**

Run: `npm run test:run -- tests/unit/schedule-date.test.ts tests/unit/schedule-engine.test.ts`

Expected: 7 tests pass. Add cases in `schedule-date.test.ts` for year boundaries, leap day, consecutive holidays, invalid ISO dates, and zero additions; expected suite total is at least 12 passing tests.

- [ ] **Step 8: Commit the schedule engine**

```powershell
git add lib/schedule tests/unit/schedule-date.test.ts tests/unit/schedule-engine.test.ts
git commit -m "feat: add Thai working-day schedule engine"
```

---

### Task 3: PostgreSQL Schema, Approved Template Seed, and Prisma Client

**Files:**
- Create: `prisma/schema.prisma`
- Create: `prisma.config.ts`
- Create: `prisma/seed.ts`
- Create: `lib/db/prisma.ts`
- Create: `lib/schedule/approved-template.ts`
- Test: `tests/unit/approved-template.test.ts`
- Modify: `package.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes: `TemplateStep` from Task 2.
- Produces: `APPROVED_TEMPLATE_STEPS`, generated Prisma client, and persistent models `Template`, `TemplateStep`, `Project`, `ProjectStep`, `Holiday`, and `HolidayCalendarYear`.

- [ ] **Step 1: Write the failing approved-template test**

```ts
// tests/unit/approved-template.test.ts
import { describe, expect, it } from "vitest";
import { APPROVED_TEMPLATE_STEPS } from "@/lib/schedule/approved-template";

describe("approved procurement template", () => {
  it("contains 13 steps whose outgoing durations total 37", () => {
    expect(APPROVED_TEMPLATE_STEPS).toHaveLength(13);
    expect(APPROVED_TEMPLATE_STEPS.reduce((sum, step) => sum + step.workingDaysToNext, 0)).toBe(37);
    expect(APPROVED_TEMPLATE_STEPS[0].workingDaysToNext).toBe(4);
    expect(APPROVED_TEMPLATE_STEPS[12].workingDaysToNext).toBe(7);
  });
});
```

- [ ] **Step 2: Run the template test to verify failure**

Run: `npm run test:run -- tests/unit/approved-template.test.ts`

Expected: FAIL with unresolved `approved-template`.

- [ ] **Step 3: Add the exact approved template constant**

```ts
// lib/schedule/approved-template.ts
import type { TemplateStep } from "./types";

export const APPROVED_TEMPLATE_STEPS = [
  { order: 1, workingDaysToNext: 4, label: "ส่วนงานพัสดุฯ จัดทำรายงานขอซื้อขอจ้าง + คำสั่งแต่งตั้งกรรมการ" },
  { order: 2, workingDaysToNext: 1, label: "ประกาศร่างประกาศและเอกสารประกวดราคาเพื่อรับฟังคำวิจารณ์" },
  { order: 3, workingDaysToNext: 3, label: "เผยแพร่ร่างประกาศและเอกสารประกวดราคาเพื่อรับฟังคำวิจารณ์" },
  { order: 4, workingDaysToNext: 4, label: "ส่วนงานพัสดุฯ จัดทำเอกสารประกาศ + ประกวดราคา" },
  { order: 5, workingDaysToNext: 1, label: "ประกาศประกวดราคาขึ้นบนเว็บไซต์กรมบัญชีกลาง" },
  { order: 6, workingDaysToNext: 5, label: "กำหนดขอรับ/ซื้อเอกสาร (ผู้สนใจสามารถดาวน์โหลดเอกสารจากเว็บไซต์กรมบัญชีกลาง)" },
  { order: 7, workingDaysToNext: 1, label: "กำหนดวันเสนอราคา (ตั้งแต่เวลา 8.30 น. - 12.00 น.) ผู้ยื่นใบเสนอราคาผ่านเว็บไซต์ของกรมบัญชีกลางเท่านั้น" },
  { order: 8, workingDaysToNext: 1, label: "ตรวจสอบเอกสารเสนอราคา (8.30 น. - 12.00 น.)" },
  { order: 9, workingDaysToNext: 1, label: "กำหนดวันเวลาในการ Present (เลือกวันใดวันหนึ่ง)" },
  { order: 10, workingDaysToNext: 4, label: "คณะกรรมการฯ พิจารณาคัดเลือกผู้ชนะ + ต่อรองราคา" },
  { order: 11, workingDaysToNext: 4, label: "ส่วนงานพัสดุฯ จัดทำเอกสารรายงานผลการพิจารณา + ประกาศผู้ชนะ" },
  { order: 12, workingDaysToNext: 1, label: "ประกาศผู้ชนะบนเว็บไซต์" },
  { order: 13, workingDaysToNext: 7, label: "ระยะเวลาอุทธรณ์และติดต่อให้ผู้รับจ้างนำส่งเอกสารเพื่อทำสัญญาและวางหลักประกันสัญญา" }
] satisfies TemplateStep[];
```

- [ ] **Step 4: Define the Prisma schema**

Use `provider = "prisma-client"`, output `../app/generated/prisma`, PostgreSQL datasource without a URL in `schema.prisma`, UUID IDs, `Decimal(15,2)` budget, `DateTime @db.Date` for schedule dates, unique `(projectId, order)` and `(templateId, order)`, cascading project-step deletion, and an integer project `version` defaulting to 1. Add `ScheduleStatus { NORMAL NEEDS_REVIEW }` and booleans for manual milestone and process-end adjustments.

Configure `prisma.config.ts` with `import "dotenv/config"`, migration path `prisma/migrations`, seed command `tsx prisma/seed.ts`, and `datasource.url = env("DATABASE_URL")`.

- [ ] **Step 5: Seed the immutable version-one template**

`prisma/seed.ts` must upsert template key `procurement-29m-v1`, replace its steps transactionally from `APPROVED_TEMPLATE_STEPS`, and disconnect in `finally`. It must use `PrismaPg` with `process.env.DATABASE_URL` and generated client import ending in `/client`.

- [ ] **Step 6: Verify Prisma and template data**

Run: `npm run prisma:generate`

Expected: generated client appears under `app/generated/prisma`.

Run: `npx prisma validate`

Expected: schema validates successfully without connecting to PostgreSQL.

Run: `npm run test:run -- tests/unit/approved-template.test.ts`

Expected: 1 test passes.

- [ ] **Step 7: Commit database contracts**

```powershell
git add prisma prisma.config.ts lib/db/prisma.ts lib/schedule/approved-template.ts tests/unit/approved-template.test.ts package.json package-lock.json .env.example
git commit -m "feat: define procurement timeline database"
```

---

### Task 4: Project Service and JSON API

**Files:**
- Create: `lib/projects/schema.ts`
- Create: `lib/projects/repository.ts`
- Create: `lib/projects/service.ts`
- Create: `lib/db/prisma-project-repository.ts`
- Create: `app/api/projects/route.ts`
- Create: `app/api/projects/[id]/route.ts`
- Create: `app/api/projects/[id]/steps/[order]/route.ts`
- Create: `app/api/projects/[id]/process-end/route.ts`
- Create: `app/api/projects/[id]/reset-schedule/route.ts`
- Test: `tests/unit/project-service.test.ts`
- Test: `tests/integration/project-api.test.ts`

**Interfaces:**
- Consumes: Task 2 schedule functions, Prisma models, `APPROVED_TEMPLATE_STEPS`.
- Produces: `ProjectService` methods `list`, `get`, `create`, `updateDetails`, `adjustStep`, `adjustProcessEnd`, `resetSchedule`, and `remove`.

- [ ] **Step 1: Define validated request contracts**

```ts
// lib/projects/schema.ts
import { z } from "zod";

export const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");
export const createProjectSchema = z.object({
  name: z.string().trim().min(1, "กรุณาระบุชื่อโครงการ").max(200),
  ownerName: z.string().trim().min(1, "กรุณาระบุผู้รับผิดชอบ").max(120),
  budget: z.coerce.number().finite().min(0, "วงเงินต้องไม่ติดลบ"),
  startDate: isoDateSchema,
  note: z.string().trim().max(2000).optional().default("")
});
export const versionSchema = z.number().int().positive();
```

- [ ] **Step 2: Write failing service tests using an in-memory repository**

Cover these exact outcomes in `tests/unit/project-service.test.ts`:

```ts
it("creates a project with 13 snapshotted milestones", async () => {
  const project = await service.create({
    name: "จัดซื้อระบบ", ownerName: "คุณสมชาย", budget: 29000000,
    startDate: "2026-07-06", note: ""
  });
  expect(project.steps).toHaveLength(13);
  expect(project.steps[0].scheduledDate).toBe("2026-07-06");
  expect(project.steps[1].scheduledDate).toBe("2026-07-10");
});

it("rejects stale project versions", async () => {
  await expect(service.resetSchedule(projectId, 1)).rejects.toThrow("PROJECT_VERSION_CONFLICT");
});
```

Add these explicit cases to the same test file:

```ts
it.each(["2026-07-11", "2026-07-12", "2026-07-28"])("rejects non-working start %s", async (startDate) => {
  await expect(service.create({ name: "โครงการ", ownerName: "เจ้าหน้าที่", budget: 1, startDate, note: "" }))
    .rejects.toThrow("START_DATE_MUST_BE_WORKING_DAY");
});

it("reports a shorter-than-template interval before committing", async () => {
  const result = await service.previewStepAdjustment(projectId, 2, "2026-07-07");
  expect(result).toMatchObject({ intervalOrder: 1, templateDuration: 4, actualDurationToNext: 1, requiresShorteningConfirmation: true });
});

it("requires overwrite confirmation when a later manual date exists", async () => {
  await expect(service.adjustStep(projectId, 2, "2026-07-14", version, false))
    .rejects.toThrow("DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED");
});

it("filters projects whose schedule overlaps the requested date range", async () => {
  const result = await service.list({ from: "2026-07-01", to: "2026-07-31", query: "สมชาย" });
  expect(result.items.every((item) => item.startDate <= "2026-07-31" && item.processEndDate >= "2026-07-01")).toBe(true);
});
```

- [ ] **Step 3: Run service tests and verify failure**

Run: `npm run test:run -- tests/unit/project-service.test.ts`

Expected: FAIL because project service modules do not exist.

- [ ] **Step 4: Implement repository contracts and ProjectService**

`ProjectRepository` must expose atomic methods that accept `expectedVersion`; each mutation returns either `{ kind: "ok", project }`, `{ kind: "conflict" }`, or `{ kind: "not_found" }`. `ProjectService` loads the applicable holiday set, invokes the pure engine, maps known errors to Thai API error codes, and never lets a route handler calculate dates itself.

For adjusting step N, return `intervalOrder = N - 1` and `actualDurationToNext` for the preceding outgoing interval, compare it with that preceding row's `workingDaysToNext`, require `confirmOverwrite=true` when downstream manual dates exist, clear downstream flags, and increment the project version once.

- [ ] **Step 5: Implement Prisma transactions and route handlers**

Use Prisma interactive transactions for create, step adjustment, reset, process-end adjustment, holiday-sensitive recalculation, and delete. Every mutating route accepts `version`; return HTTP 409 with `{ code: "PROJECT_VERSION_CONFLICT", message: "ข้อมูลนี้ถูกแก้ไขจากผู้ใช้อื่น กรุณาโหลดข้อมูลล่าสุด" }` for stale writes. Return 422 for validation and schedule rule errors, 404 for missing projects, and 500 with a generic Thai message for unexpected errors.

- [ ] **Step 6: Verify project service and API**

Run: `npm run test:run -- tests/unit/project-service.test.ts tests/integration/project-api.test.ts`

Expected: all project service tests pass; integration tests run when `TEST_DATABASE_URL` is present and otherwise report an explicit skip reason.

Run: `npm run lint && npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 7: Commit project use cases**

```powershell
git add lib/projects lib/db/prisma-project-repository.ts app/api/projects tests/unit/project-service.test.ts tests/integration/project-api.test.ts
git commit -m "feat: add project timeline API"
```

---

### Task 5: Holiday Calendar Service and Impact Confirmation

**Files:**
- Create: `lib/holidays/schema.ts`
- Create: `lib/holidays/repository.ts`
- Create: `lib/holidays/service.ts`
- Create: `lib/db/prisma-holiday-repository.ts`
- Create: `app/api/holidays/route.ts`
- Create: `app/api/holidays/preview/route.ts`
- Create: `app/api/holidays/confirm/route.ts`
- Create: `app/api/holiday-years/[year]/route.ts`
- Test: `tests/unit/holiday-service.test.ts`

**Interfaces:**
- Consumes: project versions and schedule engine.
- Produces: `HolidayService.listYear`, `previewMutation`, `confirmMutation`, and `verifyYear`.

- [ ] **Step 1: Write failing holiday behavior tests**

Test adding, editing, and deleting holidays; duplicate-date rejection; affected-project detection by date overlap; year verification; preservation of valid manual anchors; `NEEDS_REVIEW` when start/manual anchors become holidays; and version conflicts between preview and confirm.

Use this core assertion:

```ts
expect(await service.previewMutation({
  operation: "create",
  holiday: { date: "2026-07-28", name: "วันเฉลิมพระชนมพรรษา", sourceNote: "ประกาศทางการ" }
})).toMatchObject({ affectedProjectIds: [projectId] });
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/unit/holiday-service.test.ts`

Expected: FAIL with unresolved holiday service.

- [ ] **Step 3: Implement preview/confirm tokens**

Preview returns a signed, short-lived server token containing the normalized operation, impacted project IDs and their versions, plus a human-readable impact summary. Confirm verifies the token, applies the holiday mutation, recalculates automatic segments while preserving valid manual anchors, marks conflicts `NEEDS_REVIEW`, and skips projects whose version changed since preview. The response lists updated and conflicted projects separately.

Use an HMAC secret from `HOLIDAY_PREVIEW_SECRET`; do not store connection strings or secret values in logs.

- [ ] **Step 4: Implement year coverage**

`verifyYear(year, sourceNote)` upserts `HolidayCalendarYear` with `isVerifiedComplete=true`, a source note, and timestamp. Project create/update responses include `unverifiedCalendarYears: number[]`; this warns but does not block saving.

- [ ] **Step 5: Verify holiday behavior**

Run: `npm run test:run -- tests/unit/holiday-service.test.ts tests/unit/schedule-engine.test.ts`

Expected: holiday and schedule tests pass.

- [ ] **Step 6: Commit holiday use cases**

```powershell
git add lib/holidays lib/db/prisma-holiday-repository.ts app/api/holidays app/api/holiday-years tests/unit/holiday-service.test.ts
git commit -m "feat: add holiday impact management"
```

---

### Task 6: Shared Dashboard and Project Creation

**Files:**
- Modify: `app/page.tsx`
- Create: `components/dashboard/dashboard.tsx`
- Create: `components/dashboard/project-table.tsx`
- Create: `components/dashboard/project-form.tsx`
- Create: `components/ui/confirm-dialog.tsx`
- Create: `lib/ui/date-format.ts`
- Create: `lib/ui/api-client.ts`
- Test: `tests/components/dashboard.test.tsx`
- Test: `tests/components/project-form.test.tsx`

**Interfaces:**
- Consumes: project JSON API from Task 4.
- Produces: searchable, overlap-filterable dashboard and validated create flow.

- [ ] **Step 1: Write failing dashboard tests**

Test Thai headings, project rows, search by name/owner, overlap date controls, empty state, loading state, API error retention, and creation. The create test must reject `2026-07-11` as Saturday and retain all entered field values.

- [ ] **Step 2: Run dashboard tests to verify failure**

Run: `npm run test:run -- tests/components/dashboard.test.tsx tests/components/project-form.test.tsx`

Expected: FAIL because dashboard components do not exist.

- [ ] **Step 3: Implement Thai date and currency display**

```ts
// lib/ui/date-format.ts
const thaiDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Bangkok"
});
const thaiBaht = new Intl.NumberFormat("th-TH", {
  style: "currency", currency: "THB", minimumFractionDigits: 2
});
export const formatThaiDate = (iso: string) => thaiDate.format(new Date(`${iso}T12:00:00+07:00`));
export const formatBaht = (value: number) => thaiBaht.format(value);
```

- [ ] **Step 4: Implement the dashboard and create drawer**

Use accessible labels and native ISO date input plus an adjacent Buddhist Era preview. Disable save while pending, display server field errors beside inputs, preserve form state on network failure, and navigate to `/projects/{id}` after successful creation. Show project name, owner, budget, start, process end, last update, and actions in a responsive table/card layout.

- [ ] **Step 5: Verify dashboard behavior**

Run: `npm run test:run -- tests/components/dashboard.test.tsx tests/components/project-form.test.tsx`

Expected: all component tests pass.

Run: `npm run lint && npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 6: Commit the dashboard**

```powershell
git add app/page.tsx components/dashboard components/ui lib/ui tests/components/dashboard.test.tsx tests/components/project-form.test.tsx
git commit -m "feat: add shared procurement dashboard"
```

---

### Task 7: Timeline Detail, Milestone Editing, Reset, and Print

**Files:**
- Create: `app/projects/[id]/page.tsx`
- Create: `components/timeline/project-summary.tsx`
- Create: `components/timeline/timeline-table.tsx`
- Create: `components/timeline/edit-milestone-dialog.tsx`
- Create: `components/timeline/timeline-actions.tsx`
- Modify: `app/globals.css`
- Test: `tests/components/timeline-editor.test.tsx`

**Interfaces:**
- Consumes: project detail and mutation APIs.
- Produces: 13-row editable timeline, process-end editor, reset, delete, conflict recovery, and print layout.

- [ ] **Step 1: Write failing timeline editor tests**

Test 13 rows, template and adjusted duration display on the outgoing row, manual badge, invalid holiday response, shortening warning, downstream-overwrite confirmation, process-end edit, reset confirmation, 409 reload prompt, delete confirmation, and `window.print()`.

- [ ] **Step 2: Run timeline tests to verify failure**

Run: `npm run test:run -- tests/components/timeline-editor.test.tsx`

Expected: FAIL because timeline components do not exist.

- [ ] **Step 3: Implement the detail page**

Render project metadata, an unverified-calendar banner, `NEEDS_REVIEW` banner, and timeline rows. Each row shows `วันที่กำหนด`, `จำนวนวันถึงขั้นตอนถัดไป`, template duration, adjusted duration when different, and “ปรับกำหนดการ” on a manually selected date. Row 13 labels its outgoing interval “ถึงวันสิ้นสุดกระบวนการ”.

- [ ] **Step 4: Implement safe mutation dialogs**

Milestone edit first calls the API without overwrite confirmation. If it receives `DOWNSTREAM_ADJUSTMENTS_WILL_BE_REPLACED` or `DURATION_SHORTER_THAN_TEMPLATE`, show the exact Thai impact and retry only after confirmation. On 409, disable further mutation and offer “โหลดข้อมูลล่าสุด”. Reset and start-date changes state that all manual dates will be removed.

- [ ] **Step 5: Add print CSS**

Under `@media print`, hide navigation, buttons, dialogs, and search controls; remove shadows; use A4 portrait margins; prevent timeline rows from splitting across pages; print project summary and all 13 rows in black on white.

- [ ] **Step 6: Verify timeline and print behavior**

Run: `npm run test:run -- tests/components/timeline-editor.test.tsx`

Expected: all timeline tests pass.

Run: `npm run build`

Expected: production build exits 0.

- [ ] **Step 7: Commit timeline management**

```powershell
git add app/projects components/timeline app/globals.css tests/components/timeline-editor.test.tsx
git commit -m "feat: add editable procurement timeline"
```

---

### Task 8: Holiday Administration UI

**Files:**
- Create: `app/holidays/page.tsx`
- Create: `components/holidays/holiday-manager.tsx`
- Create: `components/holidays/holiday-form.tsx`
- Create: `components/holidays/holiday-impact-dialog.tsx`
- Test: `tests/components/holiday-manager.test.tsx`

**Interfaces:**
- Consumes: holiday and year-coverage APIs from Task 5.
- Produces: year filter, CRUD, coverage verification, impact preview, and confirm feedback.

- [ ] **Step 1: Write failing holiday manager tests**

Test year filtering, duplicate-date error, create/edit/delete preview summaries, confirmation token submission, updated/conflicted project counts, source note requirement for year verification, and preserved values after network errors.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm run test:run -- tests/components/holiday-manager.test.tsx`

Expected: FAIL because holiday UI modules do not exist.

- [ ] **Step 3: Implement holiday management**

Default to the current Thai calendar year while sending the Gregorian year to APIs. Show holiday date, Thai holiday name, source note, and actions. All mutations first open the impact dialog with affected project names; confirm sends only the signed token. Show `updated`, `needsReview`, and `versionConflict` results separately.

- [ ] **Step 4: Verify holiday UI**

Run: `npm run test:run -- tests/components/holiday-manager.test.tsx`

Expected: all holiday UI tests pass.

Run: `npm run lint && npm run typecheck`

Expected: both commands exit 0.

- [ ] **Step 5: Commit holiday administration**

```powershell
git add app/holidays components/holidays tests/components/holiday-manager.test.tsx
git commit -m "feat: add holiday calendar administration"
```

---

### Task 9: End-to-End Verification and Cloud Handoff

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/e2e/procurement-timeline.spec.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`
- Create: `README.md`
- Modify: `.env.example`

**Interfaces:**
- Consumes: the complete application and a disposable PostgreSQL test database.
- Produces: repeatable browser verification and provider-neutral cloud deployment instructions.

- [ ] **Step 1: Write the end-to-end scenario**

`tests/e2e/procurement-timeline.spec.ts` must create a project starting Monday, assert step 2 is Friday, edit a middle milestone, assert later dates change, add a holiday through preview/confirm, verify impacted timeline behavior, print using a stubbed `window.print`, search the dashboard, and delete the project.

- [ ] **Step 2: Run E2E to verify the red state**

Run: `npm run test:e2e -- tests/e2e/procurement-timeline.spec.ts`

Expected: FAIL until Playwright configuration, test database migration, and web server setup are connected.

- [ ] **Step 3: Configure deterministic E2E setup**

Configure Playwright for Chromium, `baseURL=http://127.0.0.1:3000`, retries only on CI, trace on first retry, and a web server command that migrates `TEST_DATABASE_URL`, seeds the template, then starts Next.js. Tests must delete their own project and holiday records.

- [ ] **Step 4: Add deployment assets and operator instructions**

The Docker image must use Node 24, install from `package-lock.json`, generate Prisma Client, build Next.js, and run as a non-root user. `README.md` must document local prerequisites, required environment variables, database migration/seed commands, full verification commands, cloud deployment with HTTPS and PostgreSQL backups, the no-auth exposure warning, and the annual official-holiday verification workflow.

- [ ] **Step 5: Run the full verification suite**

Run:

```powershell
npm run test:run
npm run lint
npm run typecheck
npm run build
npm run test:e2e
git diff --check
```

Expected: all unit/component/integration/E2E tests pass with zero failures; lint, typecheck, build, and diff check exit 0.

- [ ] **Step 6: Commit the verified release candidate**

```powershell
git add playwright.config.ts tests/e2e Dockerfile .dockerignore README.md .env.example
git commit -m "test: verify procurement timeline workflow"
```

---

## Implementation References

- Next.js installation and Node requirements: <https://nextjs.org/docs/app/getting-started/installation>
- Prisma ORM 7 with Next.js and PostgreSQL: <https://www.prisma.io/docs/ai/prompts/nextjs>
- Playwright installation and Node requirements: <https://playwright.dev/docs/next/intro>
- Approved product design: `docs/superpowers/specs/2026-07-11-procurement-timeline-management-design.md`

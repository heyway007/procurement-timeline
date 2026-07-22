# Squash PostgreSQL Migrations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a fresh Supabase database deploy the current Prisma schema from one clean initial migration.

**Architecture:** Generate one migration from an empty PostgreSQL database to the current `prisma/schema.prisma`. Remove the two incremental migrations because this Supabase project is empty except for Prisma's failed-migration record, then resolve that record and deploy the new baseline.

**Tech Stack:** Prisma 7, PostgreSQL, Supabase, TypeScript/Vitest.

## Global Constraints

- Preserve the current schema in `prisma/schema.prisma`.
- Do not drop the Supabase database or application tables.
- Keep implementation changes on the `master` branch in the main working tree.
- Verify the deployed schema, seed data, and project tests before reporting completion.

### Task 1: Create the baseline migration

**Files:**
- Create: `prisma/migrations/20260722000000_init/migration.sql`
- Delete: `prisma/migrations/20260713190000_add_bid_submission_time_slot/migration.sql`
- Delete: `prisma/migrations/20260717160000_add_selective_method_budget_category/migration.sql`

- [ ] Generate SQL from an empty database to the current Prisma schema.
- [ ] Add the generated SQL as the only migration.
- [ ] Confirm the generated SQL creates all current enums, tables, relations, indexes, and constraints.

### Task 2: Recover and deploy migration history

**Files:**
- No source changes.

- [ ] Mark the failed old migration as rolled back using Prisma's supported recovery command.
- [ ] Run `npx prisma migrate deploy` and confirm the new `init` migration finishes.

### Task 3: Seed and verify

**Files:**
- No source changes.

- [ ] Run `npx prisma db seed`.
- [ ] Query PostgreSQL metadata to verify the expected tables and completed migration.
- [ ] Run `npm run typecheck` and `npm run test:run`.


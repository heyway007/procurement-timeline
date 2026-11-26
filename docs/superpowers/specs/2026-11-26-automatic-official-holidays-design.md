# Automatically replace projected holidays

The calendar must discover official publications for 2027–2028 and replace its bundled planning data automatically. Check once daily without a page visit through the existing Cloudflare Worker, and opportunistically when a calendar year is opened. Manual entries remain authoritative; existing project dates are not silently rewritten.

## Approach

Use a shared synchronization coordinator, official-source discovery, and a distinct persisted annual-authority marker. Simply automating the old fixed-2026 fetch would never discover a new year's URL. Simply checking whether any official row exists would incorrectly hide the rest of the year after a one-day special announcement.

- Source results distinguish full annual publications, partial announcements, and cached fallback data.
- Only a full annual publication with validated dates and complete extraction promotes `officialCalendarCompleteAt` and `officialAnnualSourceUrl`.
- Full annual imports atomically replace rows owned by the previous/current annual source, preserve manual entries and separately sourced special announcements, and disable all bundled projections for that year in both display and schedule readers.
- Partial announcements merge; cached fallback and failures never promote a year.
- Use persisted attempt timestamps to limit repeated checks: 24 hours after success and 1 hour after failure. Deduplicate overlapping requests and serialize background year updates.
- The calendar GET uses the same coordinator as a daily Worker scheduled handler (00:00 UTC / 07:00 Asia/Bangkok). Manual POST remains available.
- New nullable PostgreSQL columns require the included migration before deployment. Legacy Drive documents remain readable with absent/null authority fields.

## Source constraints

Discover annual SOC publications by requested Buddhist year instead of adding future post IDs to source code. Keep network requests bounded and restricted to official HTTPS hosts. Parse real HTML/table text conservatively and validate actual dates. A matching title or nonempty snippet does not prove annual completeness.

SOC's WordPress endpoints currently return HTTP 403 from this environment. SOC's public CKAN cabinet-resolution catalog is accessible, but sampled linked PDFs are image-only scans. Do not claim such documents were imported successfully. Retain planning/last confirmed data and expose failure status when the current publication cannot be read; full automatic extraction is limited to supported machine-readable publications.

## Verification

Prove source discovery for a newly published unknown future post, partial vs complete classification, real-date rejection, and cached-fallback handling. Prove a corrected official date removes the old projected date from display and both schedule readers, with manual/special preservation and legacy-data compatibility. Prove automatic GET, daily scheduled invocation, cooldown and in-flight deduplication, and persistence failure behavior. Run all Vitest tests, typecheck, changed-file lint and the production build if Worker imports change.

## Deployment and verification record

The PostgreSQL migration is `prisma/migrations/20261126000000_add_official_calendar_authority/migration.sql`. It was applied to the live Supabase database with `npx prisma migrate deploy` on 2026-11-26, and `prisma migrate status` confirmed the schema is up to date. The user confirmed production deployment uses commit + push to GitHub `origin/master`; observe the `Workers Builds: timeline` commit check. Cron requires the Cloudflare deployment to retain `triggers.crons`; local/standalone execution still checks automatically on calendar GETs.

The final test run passed 395 tests with 2 skipped. Typecheck, Prisma schema validation, production build, and changed-file ESLint passed. An independent review identified three correctness issues (read snapshots, discovery after the first annual import, and unsupported annual rows); each was reproduced by a failing regression test and fixed.

Drive mutations are serialized within a store. This is not a distributed lock for separate Worker isolates sharing the same Drive file; the pre-existing whole-document backend has that limitation.

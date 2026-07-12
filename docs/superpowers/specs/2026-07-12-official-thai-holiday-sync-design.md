# Official Thai Government Holiday Synchronization

## Objective

Automatically keep the procurement calendar synchronized with official Thai government holidays whenever a user opens the holiday administration page. The calendar applies nationwide government holidays and Bangkok-only special government holidays, remains usable when the source is unavailable, and never overwrites holidays entered manually by users.

## Scope

- Synchronize the selected calendar year when `/holidays` is opened or the selected year changes.
- Use the Office of the Secretariat of the Cabinet (SOC) as the primary official source.
- Include nationwide government holidays and special holidays explicitly applicable to Bangkok.
- Store synchronized records locally so project scheduling remains available during source outages.
- Show the last successful synchronization, source link, scope, and cache/freshness state.
- Preserve the existing manual create, edit, delete, impact-preview, and timeline-recalculation behavior.

Automatic background scheduling, non-Bangkok regional holidays, bank-only holidays, private-sector holidays, and silent recalculation of existing projects are outside this feature.

## Source and Trust Model

The synchronization service reads official SOC holiday publications for the requested year. Each normalized holiday records:

- Gregorian ISO date;
- official Thai holiday name;
- scope: `NATIONWIDE` or `BANGKOK`;
- source URL and source label;
- source type: `OFFICIAL_SYNC`;
- time last confirmed from the source.

The parser accepts only complete dates belonging to the requested year. It rejects ambiguous text and does not infer dates that are absent from the official publication. A Bangkok-only holiday is accepted only when the official source explicitly limits it to Bangkok.

## Data Model

Extend `Holiday` with source metadata and scope while retaining the current unique calendar date rule:

- `scope`: `NATIONWIDE` or `BANGKOK`;
- `origin`: `MANUAL` or `OFFICIAL_SYNC`;
- `officialSourceUrl`: nullable URL;
- `officialSourceLabel`: nullable text;
- `lastConfirmedAt`: nullable timestamp.

Extend `HolidayCalendarYear` with synchronization state:

- `lastSyncAttemptAt`;
- `lastSuccessfulSyncAt`;
- `lastSyncStatus`: `FRESH`, `CACHED`, or `FAILED`;
- `lastSyncMessage`.

Existing records migrate as `MANUAL` and `NATIONWIDE`, so current behavior is preserved.

## Synchronization Flow

1. The holiday page requests the selected year.
2. The server returns cached holidays immediately and starts or awaits one deduplicated synchronization for that year.
3. The synchronization adapter fetches the official source with a bounded timeout, parses and validates the publication, and returns normalized records.
4. The service upserts `OFFICIAL_SYNC` records by date. It updates official names and source metadata when changed.
5. Manual records are never deleted or overwritten. When an official date conflicts with a manual record, the manual record remains authoritative and the response reports the conflict for review.
6. Official records absent from a later fetch are not deleted automatically. They are marked unconfirmed until a user reviews them, preventing a transient or incomplete publication from removing a valid holiday.
7. The page refreshes the list and shows whether the displayed data is fresh or cached.

Only one synchronization per year may run concurrently. Reopening the page within a short freshness window uses the successful cache rather than repeatedly requesting the government website.

## Timeline Impact

New or changed holidays do not silently rewrite existing project schedules. The existing impact-preview service identifies affected projects and presents their current and proposed dates. Users explicitly confirm recalculation. Newly created or manually recalculated timelines use all applicable nationwide and Bangkok holidays immediately.

Because this installation is configured for Bangkok, both scopes count as non-working days. The scope remains stored and visible so a future location setting can exclude Bangkok-only holidays without changing the imported data.

## User Interface

The holiday page adds:

- an automatic synchronization status near the year selector;
- “updated from official source” time and a clickable SOC source link;
- a `ทั่วประเทศ` or `กรุงเทพมหานคร` badge per official holiday;
- a `ราชการ` or `เพิ่มเอง` origin badge;
- a cached-data warning when the latest fetch fails;
- conflict and affected-project notices with the existing preview/confirmation flow.

The page remains usable during synchronization. Manual holiday controls remain available.

## Failure Handling

- Network timeout or SOC outage: show cached holidays and a non-blocking warning.
- Invalid or incomplete official content: reject the new payload, retain the last successful cache, and log a safe diagnostic message.
- Duplicate date: preserve a manual holiday; otherwise update the official record transactionally.
- Database failure: return an error without presenting the source as successfully synchronized.
- No successful cache: show an explicit “official holiday data unavailable” state while still allowing manual entry.

## Security and Operations

- Fetch only allow-listed HTTPS SOC URLs; do not accept a source URL from the browser.
- Apply request timeout, response-size limit, and content-type validation.
- Parse content as data without executing remote markup or scripts.
- Record source and timestamps for auditability.
- Keep synchronization server-side so browser clients cannot forge official records.

## Testing

- Unit tests for Thai/Buddhist-year date normalization, nationwide and Bangkok scope parsing, duplicate handling, and ambiguous-content rejection.
- Service tests for successful sync, cached fallback, manual-record conflicts, stale official records, and concurrent request deduplication.
- API tests for fresh, cached, and failed status responses.
- UI tests for automatic sync on page/year change, scope/origin badges, source link, cached warning, and impact confirmation.
- Regression tests proving weekend exclusion, manual holidays, editable timeline dates, and downstream recalculation remain unchanged.

## Acceptance Criteria

- Opening `/holidays` automatically checks the selected year against an official SOC source.
- Nationwide and Bangkok-only official holidays appear with their scope, source, and confirmation time.
- A source outage leaves cached holidays visible and the scheduling application operational.
- Manual holidays are never overwritten or removed by synchronization.
- Existing project dates change only after impact preview and explicit confirmation.
- Repeated page opens do not create duplicates or unnecessarily refetch a recently synchronized year.

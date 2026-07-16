# Bid Submission Time and Print Label Design

## Goal

Add a persistent bid-submission time selector to every budget category, update the displayed procurement copy from that selection, remove redundant per-row labels from printed timelines, and correct automatic Present duration chaining.

## Scope

- Apply the time selector to the milestone whose canonical label contains `กำหนดวันเสนอราคา`, regardless of whether it is step 4 or step 7.
- Provide exactly two time slots:
  - `8.30 น. - 12.00 น.`
  - `13.30 น. - 16.30 น.`
- Existing projects and new projects default to `8.30 น. - 12.00 น.`.
- Save a selection immediately and persist it across refreshes, devices, and users.
- Do not recalculate milestone dates or working-day durations when the time changes.
- Remove `(8.30 น. - 12.00 น.)` from the displayed inspection milestone `ตรวจสอบเอกสารเสนอราคา`.
- Hide the repeated mobile label `วันที่กำหนด` in print while retaining the table column header.
- Make the automatic Present milestone consume three working days in the schedule engine so the next milestone begins after the displayed Present range ends.

## Data Model

Add an optional `bidSubmissionTimeSlot` field to scheduled project steps with the allowed values:

- `MORNING`
- `AFTERNOON`

Only the bid-submission milestone uses the field. Missing values deserialize as `MORNING` so existing Google Drive records and database rows remain compatible. New timelines initialize the bid-submission milestone to `MORNING`.

The Google Drive schema accepts the optional field without increasing the document schema version. The Prisma `ProjectStep` model receives a nullable enum-backed field and a migration. Repository mappings preserve the value during create and replace operations.

## API and Service

Add a dedicated update operation for a project's bid-submission time slot. The request contains:

- project version
- selected time slot

The service verifies optimistic concurrency, locates the bid-submission milestone by canonical label rather than order, updates only its time slot, increments the project version once, and returns the updated project. Invalid slots, missing projects, version conflicts, and missing bid-submission milestones use the existing API error response conventions.

## Timeline UI

The bid-submission row displays:

1. `กำหนดวันเสนอราคา (ตั้งแต่เวลา <selected time>)`
2. A separate second line: `ผู้ยื่นใบเสนอราคาผ่านเว็บไซต์ของกรมบัญชีกลางเท่านั้น`

The date column shows the scheduled date followed by a labeled select control with two options. Selecting an option sends the update immediately. The select is disabled while saving. On success, the returned project replaces local state. On failure, the prior value remains visible and an error message is shown.

In print, the select control is hidden and the selected time appears as plain text after the scheduled date. The repeated responsive label `วันที่กำหนด` is hidden, while the main table heading `วันที่กำหนด` remains.

The inspection milestone displays only `ตรวจสอบเอกสารเสนอราคา`; its legacy parenthesized time is removed at display time so existing stored project labels also render correctly.

## Compatibility

- Budget category mappings remain unchanged.
- Step numbers are not used to identify the bid-submission milestone.
- Existing project records with no time-slot value behave as `MORNING`.
- Schedule reset preserves the default or reinitializes the bid-submission milestone to `MORNING`, consistent with rebuilding the approved template.
- Date adjustment and holiday recalculation preserve the selected time slot.

## Present Duration Correction

The approved automatic Present milestone uses `workingDaysToNext: 3`, not a display-only hardcoded three-day label. The normal schedule engine therefore calculates the following milestone from the end of the three-working-day Present window.

For the reported example:

- The prior inspection milestone is Friday 24 July 2026.
- The three eligible Present working days are Monday 27 July, Friday 31 July, and Monday 3 August after excluding the configured holidays and weekend.
- The Present display remains Monday 27 July through Monday 3 August.
- The following four-working-day milestone starts Tuesday 4 August and ends Friday 7 August. It must not start from 27 July or overlap the Present window.

When a user manually chooses one Present date, the existing behavior remains: that milestone becomes a one-working-day anchor and downstream milestones recalculate from the selected date. Total working days and SLA text use the real stored duration, so automatic timelines increase by two working days compared with the former inconsistent template.

## Testing

- Template and schedule tests verify the default morning slot for every budget category and verify that automatic Present consumes three working days before the following milestone begins.
- Service and route tests verify immediate persistent updates, version conflicts, and invalid values.
- Google Drive and Prisma mapping tests verify backward compatibility and persistence.
- Component tests verify both dropdown options, immediate save, afternoon copy, second-line bidder instruction, inspection copy cleanup, disabled saving state, error rollback, and print-only behavior.
- Existing regression tests continue to cover working-day ranges and printed step numbers, including the 27 July–3 August Present window followed by the non-overlapping 4–7 August milestone.

## Deployment

Run component and unit tests, type checking, focused linting, and the Sites production build. Publish the validated version to the existing public Procurement Timeline site after the user's existing deployment authorization.

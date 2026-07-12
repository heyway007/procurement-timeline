# Timeline Calendar Column Design

## Goal

Show the weekday beside each scheduled procurement date and add a calendar column that lets users inspect the date in a month-grid view without changing project data.

## Approved Approach

Use a custom UI-only calendar popover on the project timeline page. The timeline already stores each step date as an ISO string, so the feature derives all display values from existing project data and does not change the database schema or APIs.

## User Experience

- The scheduled date column shows the Thai weekday plus the existing Buddhist-year Thai date.
- The timeline gains a new `ปฏิทิน` column between `วันที่กำหนด` and `จัดการ`.
- Each row shows a small calendar button in that column.
- Hovering or keyboard-focusing the calendar button opens a compact month calendar.
- The calendar header shows the weekday and full Thai date, then the Buddhist-year month name.
- The selected step date is highlighted in the calendar grid.
- Previous and next month spillover dates are visible but muted.
- The calendar column is hidden when printing so the printed timeline stays compact.

## Scope

In scope:
- Project timeline milestone rows.
- The process-end row.
- Thai weekday/date formatting.
- Accessible hover/focus popover behavior.

Out of scope:
- Editing dates from the calendar popover.
- Persisting any new data.
- Changing schedule calculations or holiday rules.

## Testing

Add component coverage that verifies:
- Milestone dates include Thai weekday text.
- The new `ปฏิทิน` column is present.
- Focusing a calendar button displays the month calendar and highlights the selected date.

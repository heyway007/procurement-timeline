# Non-SLA manual dates

The user approved allowing stages in every non-SLA procurement method to share a working date and confirmed that downstream dates chosen manually must remain fixed.

- Apply the policy only to `SLA_NON_COMPLIANT`; use the existing defaults for other projects.
- Allow equal adjacent working dates, reject backwards dates, weekends and holidays.
- Keep downstream manual dates and manual completion dates, including when the first stage changes. Recalculate automatic stages between them.
- A start-only non-SLA details update uses the same preservation policy; changing category/status and explicit schedule reset still rebuild the template.
- Reject an edit atomically if recalculated stages would cross a preserved manual date. Explain the conflict without overwriting dates.
- If saved manual dates become holidays, allow correcting them one at a time and retain `NEEDS_REVIEW` until every date is valid.
- Store actual gaps next to manual anchors, including zero, so later recalculation and displayed durations agree.
- Keep the specific-method signing rule (next working day after winner announcement).
- Render zero gaps and collapsed date ranges safely, including Present and completion rows.
- Keep automatic Present-window migration active unless Present itself or its immediate successor is manually selected.
- Explicit reset continues to restore the current template.

## Approaches

Preserving absolute downstream dates was selected by the user. Shifting downstream dates while retaining custom spacing was the alternative and was not selected. Use optional engine policy flags with strict defaults so existing callers retain their behavior; pass non-SLA policy from project and holiday services.

## Validation

Cover all seven procurement categories; preservation, first-stage edits, conflicts, holiday recalculation, API messages, zero-gap UI rendering and SLA regressions. Run the full Vitest suite, lint and TypeScript checks in the main working tree on `master`.

# Timeline print layout

Approved by the user on 26 November 2026 after reviewing the print mockup and requesting left aligned step text.

- Reuse the existing Kanit font and TCEB logo. Add a compact print masthead with the document title, project name, and owner.
- Arrange method/budget, department, duration, and SLA status in a restrained indigo metadata band with icons.
- Keep sequence, icon, step, and date columns. Step headings and details align left; dates and sequence align center. Every cell aligns vertically in the middle with balanced padding.
- Give all step titles, including the signing row, the same explicit print size. Keep icons visible in print. Lightly emphasize the signing row.
- Preserve actual project text, notes, date ranges, and bid submission times; wrap long content and allow additional pages. Hide editing controls.
- Match the approved mockup while retaining browser paper/orientation/margin choices (no forced @page). Normal screen layout remains unchanged.
- Commit and push master to trigger the existing Cloudflare deployment; verify that deployment succeeds.

Approach: adapt the existing timeline DOM and print stylesheet. A separate duplicate print timeline would increase the chance of data divergence; a raster printout would lose selectable text and wrapping.

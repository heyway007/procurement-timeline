# Advance Thai government holiday calendar

Provide bundled 2027–2028 (2570–2571) holiday projections immediately in the calendar and all timeline calculations, including existing installations with no saved future holidays. Work in the main working tree on `master`.

Use a shared catalog merged by date at repository read boundaries in both storage modes. Persisted manual and official records take precedence. Virtual records have origin `PLANNED`, no official confirmation timestamp, and never enter the database or Drive document. Coverage remains unverified. Show a planning notice and badge instead of claiming official confirmation. New manual records replace the virtual row immediately in the UI.

The alternative of extending only the SOC fetch adapter would require an administrator to sync each year before either viewing or scheduling. It would also misrepresent unpublished calendars as confirmed. A read overlay provides the requested advance availability without a migration or remote writes.

## Data and limitations

- Fixed annual government holidays and applicable substitute days are included; Labour Day is bank/private-sector only and is excluded.
- 2027 lunar dates: February 21, May 20, July 18, July 19. February 22 and July 20 are projected government substitutes; July 19 is already Khao Phansa.
- 2028 projected lunar dates: February 10, May 8, July 6, July 7.
- Royal Ploughing, additional cabinet holidays, and locality-specific holidays await announcements and are not guessed.
- The catalog covers 2027–2028 only. It does not claim a complete 2029 calendar, including the substitute for December 31, 2028.
- Full-year completeness is not inferred from a successful partial import. A validated complete official annual publication now replaces the entire projected year automatically; partial announcements override individual dates. See `2026-11-26-automatic-official-holidays-design.md`.
- Existing project schedules are not silently rewritten. Newly created or explicitly recalculated timelines use the advance dates.

## Sources checked November 26, 2026

- [SEC 2027 announcement](https://www.sec.or.th/TH/Pages/News_Detail.aspx?SECID=13306): primary cross-check for 2027 lunar dates; its financial-sector substitute list is not imported as a government calendar.
- [SOC holiday FAQ](https://www.soc.go.th/?page_id=1045) and [Customs republication of government holiday rules](https://www.customs.go.th/data_files/14ce7cc3d6e4099bccdedbd903628bf2.pdf): next-working-day substitute rule. SOC direct access returned 403.
- MyHora's original advance lunar calculations for [February 2028](https://myhora.com/calendar/thai-02-2571-R01.aspx), [May 2028](https://myhora.com/calendar/thai-05-2571-R01.aspx), and [July 2028](https://myhora.com/calendar/thai-07-2571-R01.aspx). These explicitly await annual official verification.

## Verification

Test immediate availability with empty stores in both storage modes, persisted-record precedence, unique dates, provisional metadata, correct substitute days, and timeline calculations across years and consecutive holidays. Test planning UI labels and replacement after manual creation. Run the full Vitest suite, typecheck, and lint.

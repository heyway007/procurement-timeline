import type { HolidayRecord } from "./repository";

const FIXED_HOLIDAYS = [
  ["01-01", "วันขึ้นปีใหม่"],
  ["04-06", "วันจักรี"],
  ["04-13", "วันสงกรานต์"],
  ["04-14", "วันสงกรานต์"],
  ["04-15", "วันสงกรานต์"],
  ["05-04", "วันฉัตรมงคล"],
  ["06-03", "วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี"],
  ["07-28", "วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว"],
  ["08-12", "วันแม่แห่งชาติ"],
  ["10-13", "วันนวมินทรมหาราช"],
  ["10-23", "วันปิยมหาราช"],
  ["12-05", "วันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9 วันชาติ และวันพ่อแห่งชาติ"],
  ["12-10", "วันรัฐธรรมนูญ"],
  ["12-31", "วันสิ้นปี"],
] as const;

// Planning data, not a complete official publication. Dates and provenance:
// docs/superpowers/specs/2026-11-26-advance-holiday-calendar-design.md
// In particular, 2027-07-19 is Khao Phansa, so the government Asalha
// substitute moves to the next working day (July 20), unlike the bank calendar.
const VARIABLE_HOLIDAYS: Record<number, ReadonlyArray<readonly [string, string]>> = {
  2027: [
    ["02-21", "วันมาฆบูชา"],
    ["02-22", "วันหยุดชดเชยวันมาฆบูชา"],
    ["05-20", "วันวิสาขบูชา"],
    ["07-18", "วันอาสาฬหบูชา"],
    ["07-19", "วันเข้าพรรษา"],
    ["07-20", "วันหยุดชดเชยวันอาสาฬหบูชา"],
    ["10-25", "วันหยุดชดเชยวันปิยมหาราช"],
    ["12-06", "วันหยุดชดเชยวันคล้ายวันพระบรมราชสมภพ รัชกาลที่ 9"],
  ],
  2028: [
    ["01-03", "วันหยุดชดเชยวันขึ้นปีใหม่"],
    ["02-10", "วันมาฆบูชา"],
    ["05-08", "วันวิสาขบูชา"],
    ["06-05", "วันหยุดชดเชยวันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี"],
    ["07-06", "วันอาสาฬหบูชา"],
    ["07-07", "วันเข้าพรรษา"],
    ["08-14", "วันหยุดชดเชยวันแม่แห่งชาติ"],
    ["12-11", "วันหยุดชดเชยวันรัฐธรรมนูญ"],
  ],
};

function planningHolidays(year: number): HolidayRecord[] {
  const variable = VARIABLE_HOLIDAYS[year];
  if (!variable) return [];
  return [...FIXED_HOLIDAYS, ...variable].map(([day, name]) => ({
    id: `planned-${year}-${day}`,
    date: `${year}-${day}`,
    name,
    sourceNote: "ปฏิทินล่วงหน้าเพื่อวางแผน ยังไม่ใช่ประกาศวันหยุดราชการฉบับสมบูรณ์",
    scope: "NATIONWIDE",
    origin: "PLANNED",
    officialSourceUrl: null,
    officialSourceLabel: null,
    lastConfirmedAt: null,
    createdAt: "2026-11-26T00:00:00.000Z",
    updatedAt: "2026-11-26T00:00:00.000Z",
  }));
}

export function mergePlanningHolidays(stored: HolidayRecord[], year: number, officialComplete = false): HolidayRecord[] {
  const planned = officialComplete ? [] : planningHolidays(year);
  const byDate = new Map(planned.map((holiday) => [holiday.date, holiday]));
  for (const holiday of stored) byDate.set(holiday.date, holiday);
  return [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date));
}

export function withPlanningHolidayDates(stored: Iterable<string>, officialCompleteYears: Iterable<number> = []): ReadonlySet<string> {
  const dates = new Set(stored);
  const completeYears = new Set(officialCompleteYears);
  for (const year of Object.keys(VARIABLE_HOLIDAYS).map(Number)) {
    if (completeYears.has(year)) continue;
    for (const holiday of planningHolidays(year)) dates.add(holiday.date);
  }
  return dates;
}

import { withPlanningHolidayDates } from "@/lib/holidays/planning-calendar";
import { getPrisma } from "./prisma";

export function readHolidayDates(): Promise<ReadonlySet<string>> {
  return getPrisma().$transaction(async (transaction) => {
    const [holidays, officialYears] = await Promise.all([
      transaction.holiday.findMany({ select: { date: true } }),
      transaction.holidayCalendarYear.findMany({
        where: { officialCalendarCompleteAt: { not: null } },
        select: { year: true },
      }),
    ]);
    return withPlanningHolidayDates(
      holidays.map((holiday) => holiday.date.toISOString().slice(0, 10)),
      officialYears.map((record) => record.year),
    );
  }, { isolationLevel: "RepeatableRead" });
}

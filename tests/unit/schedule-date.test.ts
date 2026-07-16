import { describe, expect, it } from "vitest";
import {
  addWorkingDays,
  countWorkingDayAdditions,
  isWorkingDay,
} from "@/lib/schedule/date";

describe("working-day date math", () => {
  it("adds four working days from Monday to Friday", () => {
    expect(addWorkingDays("2026-07-06", 4, new Set())).toBe("2026-07-10");
  });

  it("skips weekends and configured holidays", () => {
    const holidays = new Set(["2026-07-28"]);
    expect(addWorkingDays("2026-07-24", 2, holidays)).toBe("2026-07-29");
  });

  it("counts additions excluding the starting date", () => {
    expect(
      countWorkingDayAdditions("2026-07-06", "2026-07-14", new Set()),
    ).toBe(6);
  });

  it("rejects weekends and configured holidays as working days", () => {
    const holidays = new Set(["2026-07-28"]);
    expect(isWorkingDay("2026-07-11", holidays)).toBe(false);
    expect(isWorkingDay("2026-07-12", holidays)).toBe(false);
    expect(isWorkingDay("2026-07-28", holidays)).toBe(false);
  });

  it("crosses year boundaries", () => {
    expect(addWorkingDays("2026-12-31", 1, new Set())).toBe("2027-01-01");
  });

  it("accepts zero additions without moving the date", () => {
    expect(addWorkingDays("2026-07-06", 0, new Set())).toBe("2026-07-06");
  });

  it("rejects invalid ISO dates and invalid amounts", () => {
    expect(() => isWorkingDay("2026-02-30", new Set())).toThrow(
      "INVALID_ISO_DATE",
    );
    expect(() => addWorkingDays("2026-07-06", -1, new Set())).toThrow(
      "INVALID_WORKING_DAY_AMOUNT",
    );
  });
});

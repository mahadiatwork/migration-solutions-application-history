import dayjs from "dayjs";
import {
  compareCrmDateTimes,
  formatCalendarDateForDisplay,
  formatDateTimeForCrm,
  getDeviceTimezone,
  parseCrmDateTime,
} from "./dateTime";

describe("device timezone helpers", () => {
  it("keeps the instant while converting a CRM timestamp to the device zone", () => {
    const crmValue = "2026-01-15T09:45:00+10:30";
    const parsed = parseCrmDateTime(crmValue);

    expect(parsed.valueOf()).toBe(Date.parse(crmValue));
    expect(parsed.format("Z")).toMatch(/^[+-]\d{2}:\d{2}$/);
  });

  it("saves a timestamp with an explicit device offset without changing its instant", () => {
    const crmValue = "2026-07-15T09:45:00+09:30";
    const serialized = formatDateTimeForCrm(parseCrmDateTime(crmValue));

    expect(serialized).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{2}:\d{2}$/);
    expect(Date.parse(serialized)).toBe(Date.parse(crmValue));
  });

  it("uses the correct device offset for a newly entered local date", () => {
    const selected = dayjs("2026-06-10T14:30:00");

    expect(formatDateTimeForCrm(selected)).toBe(
      selected.tz(getDeviceTimezone()).format("YYYY-MM-DDTHH:mm:ssZ")
    );
  });

  it("uses the offset valid on the selected date in a DST timezone", () => {
    const zone = "Australia/Sydney";
    const summer = dayjs.tz("2026-01-15T09:00:00", zone);
    const winter = dayjs.tz("2026-07-15T09:00:00", zone);

    expect(formatDateTimeForCrm(summer, zone)).toMatch(/\+11:00$/);
    expect(formatDateTimeForCrm(winter, zone)).toMatch(/\+10:00$/);
  });

  it("formats a date-only value without UTC rollover", () => {
    expect(formatCalendarDateForDisplay("2026-01-02", "en-AU")).toBe(
      "02/01/2026"
    );
  });

  it("sorts mixed-offset timestamps by instant and keeps invalid values last", () => {
    const earlier = "2026-01-01T00:30:00+14:00";
    const later = "2025-12-31T23:45:00-12:00";

    expect(compareCrmDateTimes(earlier, later, "asc")).toBeLessThan(0);
    expect(compareCrmDateTimes(earlier, later, "desc")).toBeGreaterThan(0);
    expect(compareCrmDateTimes(null, later, "asc")).toBeGreaterThan(0);
    expect(compareCrmDateTimes(null, later, "desc")).toBeGreaterThan(0);
  });
});

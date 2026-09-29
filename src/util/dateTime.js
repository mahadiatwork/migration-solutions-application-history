import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

dayjs.extend(utc);
dayjs.extend(timezone);

export const CRM_DATE_TIME_FORMAT = "YYYY-MM-DDTHH:mm:ssZ";

export const getDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "system";
  } catch {
    return "system";
  }
};

const inDeviceTimezone = (value, deviceTimezone = getDeviceTimezone()) => {
  const parsed = dayjs.isDayjs(value) ? value : dayjs(value);
  if (!parsed.isValid()) return null;

  return deviceTimezone === "system"
    ? parsed.local()
    : parsed.tz(deviceTimezone);
};

/** Parse a CRM timestamp as an instant and present it in the browser's zone. */
export const parseCrmDateTime = (value, deviceTimezone = getDeviceTimezone()) => {
  if (value === null || value === undefined || value === "") return null;
  return inDeviceTimezone(value, deviceTimezone);
};

/** Serialize the selected device-local time with the offset valid on that date. */
export const formatDateTimeForCrm = (
  value,
  deviceTimezone = getDeviceTimezone()
) => {
  const localValue = parseCrmDateTime(value, deviceTimezone);
  return localValue ? localValue.format(CRM_DATE_TIME_FORMAT) : null;
};

export const formatDateTimeForDisplay = (value, format) => {
  const localValue = parseCrmDateTime(value);
  return localValue ? localValue.format(format) : "";
};

/** Compare CRM timestamps as instants, keeping invalid values last. */
export const compareCrmDateTimes = (left, right, order = "asc") => {
  const leftTime = parseCrmDateTime(left)?.valueOf();
  const rightTime = parseCrmDateTime(right)?.valueOf();
  const leftIsValid = Number.isFinite(leftTime);
  const rightIsValid = Number.isFinite(rightTime);

  if (!leftIsValid && !rightIsValid) return 0;
  if (!leftIsValid) return 1;
  if (!rightIsValid) return -1;

  return order === "desc" ? rightTime - leftTime : leftTime - rightTime;
};

/** Format a CRM date-only value without parsing it as UTC. */
export const formatCalendarDateForDisplay = (value, locale) => {
  if (!value) return "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value));
  if (!match) return String(value);

  const [, yearText, monthText, dayText] = match;
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const day = Number(dayText);
  const localDate = new Date(year, monthIndex, day, 12);

  if (
    localDate.getFullYear() !== year ||
    localDate.getMonth() !== monthIndex ||
    localDate.getDate() !== day
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(locale).format(localDate);
};

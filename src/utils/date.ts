const MINUTE_MS = 60_000;
const JST_OFFSET_MINUTES = 9 * 60;
const JST_OFFSET_MS = JST_OFFSET_MINUTES * MINUTE_MS;

export const JST_TIME_ZONE = "Asia/Tokyo";

function pad(value: number, length = 2): string {
  return String(value).padStart(length, "0");
}

function isValidDate(date: Date): boolean {
  return Number.isFinite(date.getTime());
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number): number {
  const days = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return days[month - 1] ?? 0;
}

interface DateTimeLocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

function parseDateTimeLocalParts(value: string): DateTimeLocalParts | null {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/.exec(
      value,
    );

  if (match === null) {
    return null;
  }

  const [
    ,
    yearText,
    monthText,
    dayText,
    hourText,
    minuteText,
    secondText = "0",
    millisecondText = "0",
  ] = match;

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  const second = Number(secondText);
  const millisecond = Number(millisecondText.padEnd(3, "0"));

  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month) ||
    hour < 0 ||
    hour > 23 ||
    minute < 0 ||
    minute > 59 ||
    second < 0 ||
    second > 59
  ) {
    return null;
  }

  return { year, month, day, hour, minute, second, millisecond };
}

/**
 * Converts an absolute Date into a value accepted by a datetime-local input.
 * The output is always the wall-clock time in Japan, independent of the
 * browser/server's configured local time zone.
 */
export function toJstDateTimeLocal(date: Date): string {
  if (!isValidDate(date)) {
    return "";
  }

  const shifted = new Date(date.getTime() + JST_OFFSET_MS);
  return [
    pad(shifted.getUTCFullYear(), 4),
    "-",
    pad(shifted.getUTCMonth() + 1),
    "-",
    pad(shifted.getUTCDate()),
    "T",
    pad(shifted.getUTCHours()),
    ":",
    pad(shifted.getUTCMinutes()),
  ].join("");
}

/**
 * Parses a datetime-local value as JST and returns the corresponding instant.
 * Invalid dates (including dates such as 2026-02-30) return null.
 */
export function fromJstDateTimeLocal(value: string): Date | null {
  const parts = parseDateTimeLocalParts(value);
  if (parts === null) {
    return null;
  }

  // Build a timezone-less UTC representation first. setUTCFullYear avoids
  // Date.UTC's special handling of years 0..99.
  const wallClock = new Date(0);
  wallClock.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  wallClock.setUTCHours(
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );

  return new Date(wallClock.getTime() - JST_OFFSET_MS);
}

export const toDateTimeLocalValue = toJstDateTimeLocal;
export const fromDateTimeLocalValue = fromJstDateTimeLocal;

/** Returns the signed number of complete minutes from start to end. */
export function differenceInMinutes(start: Date, end: Date): number {
  if (!isValidDate(start) || !isValidDate(end)) {
    return Number.NaN;
  }
  return Math.floor((end.getTime() - start.getTime()) / MINUTE_MS);
}

export const calculateStayMinutes = differenceInMinutes;

export function toJstDateKey(date: Date): string {
  const value = toJstDateTimeLocal(date);
  return value === "" ? "" : value.slice(0, 10);
}

export function formatJstDate(date: Date): string {
  return toJstDateKey(date).replaceAll("-", "/");
}

export function formatJstDateTime(date: Date): string {
  const value = toJstDateTimeLocal(date);
  return value === "" ? "" : `${value.slice(0, 10).replaceAll("-", "/")} ${value.slice(11)}`;
}

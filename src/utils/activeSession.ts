import { toJstDateKey } from "./date";

const MINUTE_MS = 60_000;

function validDate(value: Date): boolean {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/**
 * Returns the number of complete stay minutes, or null when the dates are
 * invalid, reversed, equal, or less than one minute apart.
 */
export function calculateActiveSessionStayMinutes(
  enteredAt: Date,
  exitedAt: Date,
): number | null {
  if (!validDate(enteredAt) || !validDate(exitedAt)) return null;

  const minutes = Math.floor(
    (exitedAt.getTime() - enteredAt.getTime()) / MINUTE_MS,
  );
  return minutes >= 1 ? minutes : null;
}

/**
 * Formats elapsed time without wrapping after 24 hours.
 */
export function formatActiveSessionElapsed(
  enteredAt: Date,
  now: Date = new Date(),
): string {
  const minutes = calculateActiveSessionStayMinutes(enteredAt, now);
  if (minutes === null) {
    if (
      validDate(enteredAt) &&
      validDate(now) &&
      enteredAt.getTime() <= now.getTime()
    ) {
      return "0分";
    }
    return "—";
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}分`;
  if (remainingMinutes === 0) return `${hours}時間`;
  return `${hours}時間${remainingMinutes}分`;
}

export const formatElapsedTime = formatActiveSessionElapsed;

/**
 * Reports whether the two instants fall on different Japan calendar dates.
 */
export function isActiveSessionFromPreviousJstDay(
  enteredAt: Date,
  now: Date = new Date(),
): boolean {
  if (!validDate(enteredAt) || !validDate(now)) return false;

  const enteredDate = toJstDateKey(enteredAt);
  const currentDate = toJstDateKey(now);
  return enteredDate !== "" && currentDate !== "" && enteredDate < currentDate;
}

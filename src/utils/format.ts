import type {
  DurationParts,
  LibrarySession,
  SessionFormValues,
} from "../types";
import {
  COMPLETION_STATUSES,
  NEXT_DAY_REACTIONS,
  type CompletionStatus,
  type NextDayReaction,
} from "../types";
import { toJstDateTimeLocal } from "./date";

export const COMPLETION_STATUS_LABELS: Record<CompletionStatus, string> = {
  on_schedule: "予定どおり",
  mostly_on_schedule: "おおむね予定どおり",
  off_schedule: "予定から外れた",
};

export const NEXT_DAY_REACTION_LABELS: Record<NextDayReaction, string> = {
  pending: "翌日確認待ち",
  none: "なし",
  mild: "弱い",
  strong: "強い",
};

export const COMPLETION_STATUS_OPTIONS = COMPLETION_STATUSES.map((value) => ({
  value,
  label: COMPLETION_STATUS_LABELS[value],
}));

export const NEXT_DAY_REACTION_OPTIONS = NEXT_DAY_REACTIONS.map((value) => ({
  value,
  label: NEXT_DAY_REACTION_LABELS[value],
}));

export function minutesToParts(totalMinutes: number): DurationParts {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return { hours: 0, minutes: 0 };
  }

  const wholeMinutes = Math.floor(totalMinutes);
  return {
    hours: Math.floor(wholeMinutes / 60),
    minutes: wholeMinutes % 60,
  };
}

export function partsToMinutes(parts: DurationParts): number;
export function partsToMinutes(hours: number, minutes: number): number;
export function partsToMinutes(
  partsOrHours: DurationParts | number,
  minutes?: number,
): number {
  const parts =
    typeof partsOrHours === "number"
      ? { hours: partsOrHours, minutes: minutes ?? Number.NaN }
      : partsOrHours;

  if (
    !Number.isInteger(parts.hours) ||
    !Number.isInteger(parts.minutes) ||
    parts.hours < 0 ||
    parts.minutes < 0 ||
    parts.minutes > 59
  ) {
    return Number.NaN;
  }

  return parts.hours * 60 + parts.minutes;
}

/**
 * Formats a duration without value judgement: 0, 60 and 80 become
 * "0分", "1時間" and "1時間20分".
 */
export function formatMinutes(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return "—";
  }

  const { hours, minutes } = minutesToParts(totalMinutes);
  if (hours === 0) {
    return `${minutes}分`;
  }
  if (minutes === 0) {
    return `${hours}時間`;
  }
  return `${hours}時間${minutes}分`;
}

export const formatDuration = formatMinutes;

export function createEmptySessionFormValues(
  now: Date = new Date(),
): SessionFormValues {
  const dateTime = toJstDateTimeLocal(now);
  return {
    libraryId: "",
    enteredAt: dateTime,
    exitedAt: dateTime,
    concentrationScore: 5,
    anxietyScore: 5,
    fatigueScore: 5,
    selfCriticismScore: 0,
    plannedTaskCreated: false,
    plannedTaskText: "",
    actualTaskText: "",
    completionStatus: "on_schedule",
    nextDayReaction: "pending",
    nextDayNote: "",
    note: "",
  };
}

export function sessionToFormValues(
  session: LibrarySession,
): SessionFormValues {
  return {
    libraryId: session.libraryId,
    enteredAt: toJstDateTimeLocal(session.enteredAt),
    exitedAt: toJstDateTimeLocal(session.exitedAt),
    concentrationScore: session.concentrationScore,
    anxietyScore: session.anxietyScore,
    fatigueScore: session.fatigueScore,
    selfCriticismScore: session.selfCriticismScore,
    plannedTaskCreated: session.plannedTaskCreated,
    plannedTaskText: session.plannedTaskText,
    actualTaskText: session.actualTaskText,
    completionStatus: session.completionStatus,
    nextDayReaction: session.nextDayReaction,
    nextDayNote: session.nextDayNote,
    note: session.note,
  };
}

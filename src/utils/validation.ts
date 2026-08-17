import {
  COMPLETION_STATUSES,
  NEXT_DAY_REACTIONS,
  type LibraryFormErrors,
  type LibraryFormValues,
  type NextDayReactionFormValues,
  type ParsedSessionFormValues,
  type SessionFormErrors,
  type SessionFormValues,
} from "../types";
import { differenceInMinutes, fromJstDateTimeLocal } from "./date";
import { partsToMinutes } from "./format";

const SCORE_MIN = 0;
const SCORE_MAX = 10;

function isMemberOf<const T extends readonly string[]>(
  values: T,
  value: unknown,
): value is T[number] {
  return typeof value === "string" && values.includes(value);
}

function parseWholeNumber(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

/**
 * Parses an hours/minutes input pair. Minutes must be within 0..59; hours
 * must be a non-negative whole number.
 */
export function parseDurationParts(
  hoursValue: string,
  minutesValue: string,
): number | null {
  const hours = parseWholeNumber(hoursValue);
  const minutes = parseWholeNumber(minutesValue);

  if (hours === null || minutes === null || minutes > 59) {
    return null;
  }

  const total = partsToMinutes(hours, minutes);
  return Number.isSafeInteger(total) ? total : null;
}

function validateScore(
  value: number,
  field:
    | "concentrationScore"
    | "anxietyScore"
    | "fatigueScore"
    | "selfCriticismScore",
  label: string,
  errors: SessionFormErrors,
): void {
  if (
    !Number.isInteger(value) ||
    value < SCORE_MIN ||
    value > SCORE_MAX
  ) {
    errors[field] = `${label}は0〜10の整数で入力してください`;
  }
}

function validateUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateSessionForm(
  values: SessionFormValues,
): SessionFormErrors {
  const errors: SessionFormErrors = {};

  if (values.libraryId.trim() === "") {
    errors.libraryId = "図書館を選択してください";
  }

  const enteredAt = fromJstDateTimeLocal(values.enteredAt);
  const exitedAt = fromJstDateTimeLocal(values.exitedAt);

  if (enteredAt === null) {
    errors.enteredAt = "入室日時を入力してください";
  }
  if (exitedAt === null) {
    errors.exitedAt = "退室日時を入力してください";
  }

  let stayMinutes: number | null = null;
  if (enteredAt !== null && exitedAt !== null) {
    stayMinutes = differenceInMinutes(enteredAt, exitedAt);
    if (exitedAt.getTime() <= enteredAt.getTime() || stayMinutes <= 0) {
      errors.exitedAt = "退室日時は入室日時より後にしてください";
    }
  }

  validateScore(
    values.concentrationScore,
    "concentrationScore",
    "集中度",
    errors,
  );
  validateScore(values.anxietyScore, "anxietyScore", "焦り", errors);
  validateScore(values.fatigueScore, "fatigueScore", "疲労", errors);
  validateScore(
    values.selfCriticismScore,
    "selfCriticismScore",
    "自己否定の割合",
    errors,
  );

  if (!isMemberOf(COMPLETION_STATUSES, values.completionStatus)) {
    errors.completionStatus = "終了状況を選択してください";
  }
  if (!isMemberOf(NEXT_DAY_REACTIONS, values.nextDayReaction)) {
    errors.nextDayReaction = "翌日の反動を選択してください";
  }

  return errors;
}

export function validateLibraryForm(
  values: LibraryFormValues,
): LibraryFormErrors {
  const errors: LibraryFormErrors = {};

  if (values.name.trim() === "") {
    errors.name = "図書館名を入力してください";
  }

  const mapUrl = values.googleMapsUrl.trim();
  if (mapUrl !== "" && !validateUrl(mapUrl)) {
    errors.googleMapsUrl = "httpまたはhttpsのURLを入力してください";
  }

  const latitudeText = values.latitude.trim();
  const longitudeText = values.longitude.trim();
  if (latitudeText !== "") {
    const latitude = Number(latitudeText);
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      errors.latitude = "緯度は-90〜90で入力してください";
    }
  }
  if (longitudeText !== "") {
    const longitude = Number(longitudeText);
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      errors.longitude = "経度は-180〜180で入力してください";
    }
  }

  return errors;
}

export function validateNextDayReactionForm(
  values: NextDayReactionFormValues,
): Partial<Record<keyof NextDayReactionFormValues, string>> {
  if (!isMemberOf(NEXT_DAY_REACTIONS, values.nextDayReaction)) {
    return { nextDayReaction: "翌日の反動を選択してください" };
  }
  return {};
}

export function hasValidationErrors<T extends object>(
  errors: Partial<Record<keyof T, string>>,
): boolean {
  return Object.keys(errors).length > 0;
}

/**
 * Converts already-valid form values into domain values. Returning null keeps
 * callers from accidentally persisting coerced or partially invalid input.
 */
export function parseSessionForm(
  values: SessionFormValues,
): ParsedSessionFormValues | null {
  if (hasValidationErrors(validateSessionForm(values))) {
    return null;
  }

  const enteredAt = fromJstDateTimeLocal(values.enteredAt);
  const exitedAt = fromJstDateTimeLocal(values.exitedAt);

  if (
    enteredAt === null ||
    exitedAt === null
  ) {
    return null;
  }

  return {
    libraryId: values.libraryId.trim(),
    enteredAt,
    exitedAt,
    stayMinutes: differenceInMinutes(enteredAt, exitedAt),
    concentrationScore: values.concentrationScore,
    anxietyScore: values.anxietyScore,
    fatigueScore: values.fatigueScore,
    selfCriticismScore: values.selfCriticismScore,
    plannedTaskCreated: values.plannedTaskCreated,
    plannedTaskText: values.plannedTaskText.trim(),
    actualTaskText: values.actualTaskText.trim(),
    completionStatus: values.completionStatus,
    nextDayReaction: values.nextDayReaction,
    nextDayNote: values.nextDayNote.trim(),
    note: values.note.trim(),
  };
}

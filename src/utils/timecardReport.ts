import {
  COMPLETION_STATUSES,
  type CompletionStatus,
} from "../types";
import { differenceInMinutes, fromJstDateTimeLocal } from "./date";

export interface TimecardReportFormValues {
  libraryId: string;
  enteredAt: string;
  exitedAt: string;
  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismScore: number;
  plannedTaskCreated: boolean;
  plannedTaskText: string;
  actualTaskText: string;
  completionStatus: CompletionStatus;
  note: string;
}

export type TimecardReportFormErrors = Partial<
  Record<keyof TimecardReportFormValues, string>
>;

export interface ParsedTimecardReport {
  libraryId: string;
  enteredAt: Date;
  exitedAt: Date;
  stayMinutes: number;
  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismScore: number;
  plannedTaskCreated: boolean;
  plannedTaskText: string;
  actualTaskText: string;
  completionStatus: CompletionStatus;
  note: string;
}

function validateScore(
  value: number,
  field:
    | "concentrationScore"
    | "anxietyScore"
    | "fatigueScore"
    | "selfCriticismScore",
  label: string,
  errors: TimecardReportFormErrors,
) {
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    errors[field] = `${label}は0〜10の整数で入力してください`;
  }
}

export function validateTimecardReport(
  values: TimecardReportFormValues,
): TimecardReportFormErrors {
  const errors: TimecardReportFormErrors = {};
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

  if (enteredAt !== null && exitedAt !== null) {
    const stayMinutes = differenceInMinutes(enteredAt, exitedAt);
    if (exitedAt.getTime() <= enteredAt.getTime() || stayMinutes < 1) {
      errors.exitedAt = "退室日時は入室日時より1分以上後にしてください";
    }
  }

  validateScore(
    values.concentrationScore,
    "concentrationScore",
    "集中度",
    errors,
  );
  validateScore(values.anxietyScore, "anxietyScore", "焦り・不安", errors);
  validateScore(values.fatigueScore, "fatigueScore", "疲労度", errors);
  validateScore(
    values.selfCriticismScore,
    "selfCriticismScore",
    "自己否定の割合",
    errors,
  );

  if (
    !(COMPLETION_STATUSES as readonly string[]).includes(
      values.completionStatus,
    )
  ) {
    errors.completionStatus = "終了状況を選択してください";
  }

  return errors;
}

export function parseTimecardReport(
  values: TimecardReportFormValues,
): ParsedTimecardReport | null {
  if (Object.keys(validateTimecardReport(values)).length > 0) return null;

  const enteredAt = fromJstDateTimeLocal(values.enteredAt);
  const exitedAt = fromJstDateTimeLocal(values.exitedAt);
  if (enteredAt === null || exitedAt === null) {
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
    note: values.note.trim(),
  };
}

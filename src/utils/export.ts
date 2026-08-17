import {
  jstDateKeysInRange,
  toJstDateKey,
  toJstDateTimeLocal,
} from "./date";

export const EXPORT_TABLE_HEADERS = [
  "作業日",
  "入室時刻",
  "退室時刻",
  "滞在時間",
  "集中度（0～10）",
  "焦り・不安（0～10）",
  "疲労度（0～10）",
  "自己否定割合（0～10）",
] as const;

export interface ExportSessionRecord {
  enteredAt: Date;
  exitedAt: Date;
  stayMinutes: number;
  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismScore: number;
}

export interface ExportTableRow {
  workDate: string;
  enteredTime: string;
  exitedTime: string;
  stayDuration: string;
  concentrationScore: string;
  anxietyScore: string;
  fatigueScore: string;
  selfCriticismScore: string;
}

export interface ExportPeriod {
  startDate: string;
  endDate: string;
}

function formatJstPart(
  value: unknown,
  part: "date" | "time",
): string {
  if (!(value instanceof Date)) return "-";
  const dateTime = toJstDateTimeLocal(value);
  if (dateTime === "") return "-";
  return part === "date" ? dateTime.slice(5, 10).replace("-", "/") : dateTime.slice(11);
}

export function formatExportJstDate(value: unknown): string {
  return formatJstPart(value, "date");
}

export function formatExportJstTime(value: unknown): string {
  return formatJstPart(value, "time");
}

export function formatMinutesAsClock(value: unknown): string {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    return "-";
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function formatScore(value: unknown): string {
  return typeof value === "number" && Number.isInteger(value)
    ? String(value)
    : "-";
}

function enteredAtMillis(session: ExportSessionRecord): number {
  const value = session.enteredAt.getTime();
  return Number.isFinite(value) ? value : Number.POSITIVE_INFINITY;
}

function tableRowFromSession(session: ExportSessionRecord): ExportTableRow {
  return {
    workDate: formatExportJstDate(session.enteredAt),
    enteredTime: formatExportJstTime(session.enteredAt),
    exitedTime: formatExportJstTime(session.exitedAt),
    stayDuration: formatMinutesAsClock(session.stayMinutes),
    concentrationScore: formatScore(session.concentrationScore),
    anxietyScore: formatScore(session.anxietyScore),
    fatigueScore: formatScore(session.fatigueScore),
    selfCriticismScore: formatScore(session.selfCriticismScore),
  };
}

function emptyTableRow(dateKey: string): ExportTableRow {
  const emptyValue = "---";
  return {
    workDate: dateKey.slice(5).replace("-", "/"),
    enteredTime: emptyValue,
    exitedTime: emptyValue,
    stayDuration: emptyValue,
    concentrationScore: emptyValue,
    anxietyScore: emptyValue,
    fatigueScore: emptyValue,
    selfCriticismScore: emptyValue,
  };
}

export function createExportTableRows(
  sessions: readonly ExportSessionRecord[],
  period?: ExportPeriod,
): ExportTableRow[] {
  const sortedSessions = [...sessions].sort(
    (left, right) => enteredAtMillis(left) - enteredAtMillis(right),
  );
  if (period === undefined) {
    return sortedSessions.map(tableRowFromSession);
  }

  const sessionsByDate = new Map<string, ExportSessionRecord[]>();
  sortedSessions.forEach((session) => {
    const dateKey = toJstDateKey(session.enteredAt);
    if (dateKey === "") return;
    const records = sessionsByDate.get(dateKey) ?? [];
    records.push(session);
    sessionsByDate.set(dateKey, records);
  });

  return jstDateKeysInRange(period.startDate, period.endDate).flatMap(
    (dateKey) => {
      const records = sessionsByDate.get(dateKey);
      return records && records.length > 0
        ? records.map(tableRowFromSession)
        : [emptyTableRow(dateKey)];
    },
  );
}

function rowValues(row: ExportTableRow): string[] {
  return [
    row.workDate,
    row.enteredTime,
    row.exitedTime,
    row.stayDuration,
    row.concentrationScore,
    row.anxietyScore,
    row.fatigueScore,
    row.selfCriticismScore,
  ];
}

export function generateSessionsMarkdown(
  sessions: readonly ExportSessionRecord[],
  period?: ExportPeriod,
): string {
  const rows = createExportTableRows(sessions, period);
  if (rows.length === 0) return "";

  const header = `| ${EXPORT_TABLE_HEADERS.join(" | ")} |`;
  const separator = "|---|---:|---:|---:|---:|---:|---:|---:|";
  return [
    header,
    separator,
    ...rows.map((row) => `| ${rowValues(row).join(" | ")} |`),
  ].join("\n");
}

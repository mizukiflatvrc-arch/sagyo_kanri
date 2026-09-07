import {
  jstDateKeysInRange,
  shiftJstDateKey,
  toJstDateKey,
} from "./date";
import type {
  ChangeAssessment,
  DailyReportData,
  LibraryReportData,
  MetricComparison,
  PeriodMetrics,
  ReportComparisons,
  ReportData,
  ReportPeriod,
  ReportPeriods,
  ReportSessionRecord,
} from "../report/types";

type ScoreKey =
  | "concentrationScore"
  | "anxietyScore"
  | "fatigueScore"
  | "selfCriticismScore";

function isValidNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isValidScore(value: unknown): value is number {
  return isValidNumber(value) && value >= 0 && value <= 10;
}

function validStayMinutes(value: unknown): number {
  return isValidNumber(value) && value >= 0 ? value : 0;
}

function timestamp(value: Date): number {
  const milliseconds = value.getTime();
  return Number.isFinite(milliseconds)
    ? milliseconds
    : Number.POSITIVE_INFINITY;
}

function average(values: readonly (number | null)[]): number | null {
  const validValues = values.filter(isValidNumber);
  if (validValues.length === 0) return null;
  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

function weightedAverage(
  sessions: readonly ReportSessionRecord[],
  key: Exclude<ScoreKey, "fatigueScore">,
): number | null {
  let weightedTotal = 0;
  let totalMinutes = 0;

  sessions.forEach((session) => {
    const minutes = validStayMinutes(session.stayMinutes);
    const score = session[key];
    if (minutes <= 0 || !isValidScore(score)) return;
    weightedTotal += score * minutes;
    totalMinutes += minutes;
  });

  return totalMinutes > 0 ? weightedTotal / totalMinutes : null;
}

function joinedText(
  sessions: readonly ReportSessionRecord[],
  key: "actualTaskText" | "note",
): string {
  const values = sessions
    .map((session) => session[key].trim())
    .filter((value) => value !== "");
  return values.length > 0 ? values.join(" / ") : "-";
}

function aggregateDay(
  date: string,
  sessions: readonly ReportSessionRecord[],
  libraryNameById: ReadonlyMap<string, string>,
): DailyReportData {
  if (sessions.length === 0) {
    return {
      date,
      sessionCount: 0,
      libraryIds: [],
      libraryNames: [],
      stayMinutes: null,
      concentrationScore: null,
      anxietyScore: null,
      fatigueScore: null,
      selfCriticismScore: null,
      workText: "-",
      noteText: "-",
    };
  }

  const sorted = [...sessions].sort(
    (left, right) => timestamp(left.enteredAt) - timestamp(right.enteredAt),
  );
  const libraryIds = [
    ...new Set(sorted.map((session) => session.libraryId).filter(Boolean)),
  ];
  const lastSession = sorted.at(-1);
  const fatigueScore =
    lastSession && isValidScore(lastSession.fatigueScore)
      ? lastSession.fatigueScore
      : null;

  return {
    date,
    sessionCount: sorted.length,
    libraryIds,
    libraryNames: libraryIds.map(
      (libraryId) => libraryNameById.get(libraryId) ?? "不明な図書館",
    ),
    stayMinutes: sorted.reduce(
      (sum, session) => sum + validStayMinutes(session.stayMinutes),
      0,
    ),
    concentrationScore: weightedAverage(sorted, "concentrationScore"),
    anxietyScore: weightedAverage(sorted, "anxietyScore"),
    fatigueScore,
    selfCriticismScore: weightedAverage(sorted, "selfCriticismScore"),
    workText: joinedText(sorted, "actualTaskText"),
    noteText: joinedText(sorted, "note"),
  };
}

export function calculateReportPeriods(
  targetDate: string,
  days: number,
): ReportPeriods | null {
  if (!Number.isSafeInteger(days) || days < 1) return null;
  const targetStart = shiftJstDateKey(targetDate, -(days - 1));
  if (targetStart === "") return null;
  const comparisonEnd = shiftJstDateKey(targetStart, -1);
  const comparisonStart = shiftJstDateKey(comparisonEnd, -(days - 1));
  if (comparisonStart === "" || comparisonEnd === "") return null;

  return {
    target: { startDate: targetStart, endDate: targetDate, days },
    comparison: {
      startDate: comparisonStart,
      endDate: comparisonEnd,
      days,
    },
  };
}

export function aggregateReportDays(
  sessions: readonly ReportSessionRecord[],
  period: ReportPeriod,
  libraryNameById: ReadonlyMap<string, string> = new Map(),
): DailyReportData[] {
  const sessionsByDate = new Map<string, ReportSessionRecord[]>();
  sessions.forEach((session) => {
    const date = toJstDateKey(session.enteredAt);
    if (date < period.startDate || date > period.endDate) return;
    const records = sessionsByDate.get(date) ?? [];
    records.push(session);
    sessionsByDate.set(date, records);
  });

  return jstDateKeysInRange(period.startDate, period.endDate).map((date) =>
    aggregateDay(date, sessionsByDate.get(date) ?? [], libraryNameById),
  );
}

export function aggregatePeriodMetrics(
  days: readonly DailyReportData[],
): PeriodMetrics {
  const workDays = days.filter((day) => day.sessionCount > 0);
  const totalStayMinutes = workDays.reduce(
    (sum, day) => sum + (day.stayMinutes ?? 0),
    0,
  );

  return {
    hasSessions: workDays.length > 0,
    workDays: workDays.length,
    totalStayMinutes,
    averageStayMinutes:
      workDays.length > 0 ? totalStayMinutes / workDays.length : null,
    concentrationScore: average(
      workDays.map((day) => day.concentrationScore),
    ),
    anxietyScore: average(workDays.map((day) => day.anxietyScore)),
    fatigueScore: average(workDays.map((day) => day.fatigueScore)),
    selfCriticismScore: average(
      workDays.map((day) => day.selfCriticismScore),
    ),
  };
}

function metricComparison(
  current: number | null,
  previous: number | null,
  positiveIsImprovement?: boolean,
): MetricComparison {
  if (current === null || previous === null) {
    return { difference: null, assessment: null };
  }

  const difference = current - previous;
  let assessment: ChangeAssessment | null = null;
  if (positiveIsImprovement !== undefined) {
    if (Math.abs(difference) <= 0.2 + Number.EPSILON) {
      assessment = "unchanged";
    } else {
      const improved = positiveIsImprovement ? difference > 0 : difference < 0;
      assessment = improved ? "improved" : "worsened";
    }
  }
  return { difference, assessment };
}

export function comparePeriodMetrics(
  current: PeriodMetrics,
  previous: PeriodMetrics,
): ReportComparisons {
  if (!previous.hasSessions) {
    const unavailable = () => ({ difference: null, assessment: null });
    return {
      workDays: unavailable(),
      averageStayMinutes: unavailable(),
      concentrationScore: unavailable(),
      anxietyScore: unavailable(),
      fatigueScore: unavailable(),
      selfCriticismScore: unavailable(),
    };
  }

  return {
    workDays: metricComparison(current.workDays, previous.workDays),
    averageStayMinutes: metricComparison(
      current.averageStayMinutes,
      previous.averageStayMinutes,
    ),
    concentrationScore: metricComparison(
      current.concentrationScore,
      previous.concentrationScore,
      true,
    ),
    anxietyScore: metricComparison(
      current.anxietyScore,
      previous.anxietyScore,
      false,
    ),
    fatigueScore: metricComparison(
      current.fatigueScore,
      previous.fatigueScore,
      false,
    ),
    selfCriticismScore: metricComparison(
      current.selfCriticismScore,
      previous.selfCriticismScore,
      false,
    ),
  };
}

export function aggregateLibraries(
  sessions: readonly ReportSessionRecord[],
  period: ReportPeriod,
  libraryNameById: ReadonlyMap<string, string>,
): LibraryReportData[] {
  const byLibrary = new Map<string, ReportSessionRecord[]>();
  sessions.forEach((session) => {
    const date = toJstDateKey(session.enteredAt);
    if (
      date < period.startDate ||
      date > period.endDate ||
      session.libraryId === ""
    ) {
      return;
    }
    const records = byLibrary.get(session.libraryId) ?? [];
    records.push(session);
    byLibrary.set(session.libraryId, records);
  });

  return [...byLibrary.entries()]
    .map(([libraryId, records]) => {
      const days = aggregateReportDays(records, period, libraryNameById);
      return {
        libraryId,
        libraryName: libraryNameById.get(libraryId) ?? "不明な図書館",
        ...aggregatePeriodMetrics(days),
      };
    })
    .sort((left, right) =>
      left.libraryName.localeCompare(right.libraryName, "ja"),
    );
}

export function createReportData(
  sessions: readonly ReportSessionRecord[],
  periods: ReportPeriods,
  libraryNameById: ReadonlyMap<string, string>,
): ReportData {
  const targetDays = aggregateReportDays(
    sessions,
    periods.target,
    libraryNameById,
  );
  const comparisonDays = aggregateReportDays(
    sessions,
    periods.comparison,
    libraryNameById,
  );
  const targetMetrics = aggregatePeriodMetrics(targetDays);
  const comparisonMetrics = aggregatePeriodMetrics(comparisonDays);

  return {
    periods,
    targetDays,
    comparisonDays,
    targetMetrics,
    comparisonMetrics,
    comparisons: comparePeriodMetrics(targetMetrics, comparisonMetrics),
    libraries: aggregateLibraries(
      sessions,
      periods.target,
      libraryNameById,
    ),
  };
}

export function formatReportScore(value: number | null): string {
  return value === null ? "-" : value.toFixed(1);
}

export function formatReportDuration(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value < 0) return "-";
  const totalMinutes = Math.round(value);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}分`;
  return `${hours}時間${minutes}分`;
}

export function formatReportDate(dateKey: string): string {
  const [, month = "", day = ""] = dateKey.split("-");
  return `${Number(month)}/${Number(day)}`;
}

export function formatReportDateLong(dateKey: string): string {
  const [year = "", month = "", day = ""] = dateKey.split("-");
  return `${Number(year)}/${Number(month)}/${Number(day)}`;
}

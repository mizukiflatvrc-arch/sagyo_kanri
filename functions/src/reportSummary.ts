import type { Request } from "firebase-functions/v2/https";
import type { Response } from "express";
import type {
  PeriodMetrics,
  ReportComparisons,
  ReportSummary,
  ReportSummaryInput,
  ReportSummaryPeriodInput,
} from "../../src/report/types";

type Check = (value: unknown) => boolean;
const MAX_REPORT_DAYS = 30;
const MAX_TEXT_LENGTH = 4000;
const MAX_LIBRARY_NAME_LENGTH = 200;
const MAX_LIBRARY_ID_LENGTH = 200;
const MAX_LIBRARIES = 100;
const MAX_DAY_LIBRARIES = 20;
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const string: Check = (value) => typeof value === "string";
const boundedString = (maxLength: number): Check =>
  (value) => typeof value === "string" && value.length <= maxLength;
const number: Check = (value) => typeof value === "number" && Number.isFinite(value);
const nullableNumber: Check = (value) => value === null || number(value);
const array = (check: Check, maxLength: number): Check =>
  (value) => Array.isArray(value) && value.length <= maxLength && value.every(check);

// Exact keys prevent undeclared client instructions or identity fields from
// being passed through to the model, including inside nested records.
function shape(fields: Record<string, Check>): Check {
  return (value) => object(value) &&
    Object.keys(value).length === Object.keys(fields).length &&
    Object.entries(fields).every(([key, check]) => Object.hasOwn(value, key) && check(value[key]));
}

const date: Check = (value) => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const scores = {
  concentrationScore: nullableNumber,
  anxietyScore: nullableNumber,
  fatigueScore: nullableNumber,
  selfCriticismScore: nullableNumber,
};
const metrics = {
  hasSessions: (value: unknown) => typeof value === "boolean",
  workDays: number,
  totalStayMinutes: number,
  averageStayMinutes: nullableNumber,
  ...scores,
} satisfies Record<keyof PeriodMetrics, Check>;
const periodShape = shape({
  period: shape({
    startDate: date,
    endDate: date,
    days: (value) => number(value) && Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_REPORT_DAYS,
  }),
  metrics: shape(metrics),
  days: array(shape({
    date,
    libraries: array(boundedString(MAX_LIBRARY_NAME_LENGTH), MAX_DAY_LIBRARIES),
    stayMinutes: nullableNumber,
    ...scores,
    workText: boundedString(MAX_TEXT_LENGTH),
    noteText: boundedString(MAX_TEXT_LENGTH),
  }), MAX_REPORT_DAYS),
});
const period: Check = (value) => {
  if (!periodShape(value)) return false;
  const { period: range, days } = value as ReportSummaryPeriodInput;
  return range.startDate <= range.endDate &&
    range.days === days.length &&
    new Set(days.map((day) => day.date)).size === days.length &&
    days.every((day) => day.date >= range.startDate && day.date <= range.endDate);
};
const metricComparison = shape({
  difference: nullableNumber,
  assessment: (value) => value === null || value === "improved" || value === "worsened" || value === "unchanged",
});
const inputShape = shape({
  target: period,
  comparison: period,
  comparisons: shape({
    workDays: metricComparison,
    averageStayMinutes: metricComparison,
    concentrationScore: metricComparison,
    anxietyScore: metricComparison,
    fatigueScore: metricComparison,
    selfCriticismScore: metricComparison,
  } satisfies Record<keyof ReportComparisons, Check>),
  libraries: array(shape({
    libraryId: boundedString(MAX_LIBRARY_ID_LENGTH),
    libraryName: boundedString(MAX_LIBRARY_NAME_LENGTH),
    ...metrics,
  }), MAX_LIBRARIES),
  // Phase 1 has no additional data sources. Add explicit validated fields when
  // a future integration is introduced; do not forward arbitrary JSON.
  additionalContext: shape({}),
} satisfies Record<keyof ReportSummaryInput, Check>);

export function parseReportSummaryRequest(body: unknown): ReportSummaryInput {
  if (!shape({ input: inputShape })(body)) throw new Error("Invalid request body");
  return (body as { input: ReportSummaryInput }).input;
}

const summaryShape = shape({
  daily: array(shape({ date, workSummary: string, noteSummary: string }), MAX_REPORT_DAYS),
  workSummary: string,
  noteSummary: string,
  overview: string,
} satisfies Record<keyof ReportSummary, Check>);

export function parseModelSummary(text: string | undefined, input: ReportSummaryInput): ReportSummary {
  const value: unknown = JSON.parse(text ?? "");
  if (!summaryShape(value)) throw new Error("Invalid model output");
  const summary = value as ReportSummary;
  // The client includes non-work days with null stayMinutes. Require exactly
  // one entry per work day, so fabricated, duplicate and missing days fail.
  const expected = new Set(input.target.days
    .filter((day) => day.stayMinutes !== null)
    .map((day) => day.date));
  if (summary.daily.length !== expected.size) throw new Error("Invalid summary dates");
  for (const day of summary.daily) {
    if (day.date < input.target.period.startDate || day.date > input.target.period.endDate ||
        !expected.delete(day.date)) throw new Error("Invalid summary dates");
  }
  return summary;
}

export class ServerConfigurationError extends Error {}

interface Dependencies {
  verifyIdToken(token: string): Promise<unknown>;
  generate(input: ReportSummaryInput): Promise<string | undefined>;
  logError(message: string): void;
}

export function createReportSummaryHandler(dependencies: Dependencies) {
  return async (request: Pick<Request, "method" | "headers" | "body">, response: Pick<Response, "set" | "status" | "json">): Promise<void> => {
    response.set("Cache-Control", "no-store");
    if (request.method !== "POST") {
      response.set("Allow", "POST");
      response.status(405).json({ error: "Method not allowed" });
      return;
    }
    const authorization = request.headers.authorization;
    const token = typeof authorization === "string" ? /^Bearer ([^\s]+)$/i.exec(authorization)?.[1] : undefined;
    if (!token) {
      response.status(401).json({ error: "Missing or invalid authentication" });
      return;
    }
    try {
      await dependencies.verifyIdToken(token);
    } catch (error) {
      if (error instanceof ServerConfigurationError) {
        dependencies.logError(error.message);
        response.status(500).json({ error: "Server configuration error" });
      } else {
        response.status(401).json({ error: "Missing or invalid authentication" });
      }
      return;
    }
    let input: ReportSummaryInput;
    try {
      input = parseReportSummaryRequest(request.body as unknown);
    } catch {
      response.status(400).json({ error: "Invalid request body" });
      return;
    }
    try {
      const result = await dependencies.generate(input);
      response.status(200).json(parseModelSummary(result, input));
    } catch (error) {
      if (error instanceof ServerConfigurationError) {
        dependencies.logError(error.message);
        response.status(500).json({ error: "Server configuration error" });
      } else {
        // Never log tokens, input, model output or provider error objects.
        dependencies.logError("Report summary generation or output validation failed");
        response.status(502).json({ error: "Summary generation failed" });
      }
    }
  };
}

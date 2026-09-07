import type {
  DailyReportData,
  ReportData,
  ReportDailySummary,
  ReportSummary,
  ReportSummaryDayInput,
  ReportSummaryInput,
} from "./types";

export interface ReportSummarizer {
  summarize(input: ReportSummaryInput): Promise<ReportSummary>;
}

const SUMMARY_INSTRUCTIONS = [
  "対象期間と直前の同日数期間を比較し、通院時に読みやすい簡潔な日本語で要約してください。",
  "dailyは対象期間の作業日のみを日付ごとにまとめ、workSummaryとnoteSummaryはそれぞれ1〜2文にしてください。",
  "期間全体のworkSummary、noteSummary、overviewを返してください。",
  "数値は入力値のみを使用し、再計算や推測をしないでください。",
  "傾向や関連性は記述できますが、因果関係、医療診断、医学的評価を断定しないでください。",
  "出力は指定された構造のJSONだけにしてください。",
].join("\n");

function dayInput(day: DailyReportData): ReportSummaryDayInput {
  return {
    date: day.date,
    libraries: day.libraryNames,
    stayMinutes: day.stayMinutes,
    concentrationScore: day.concentrationScore,
    anxietyScore: day.anxietyScore,
    fatigueScore: day.fatigueScore,
    selfCriticismScore: day.selfCriticismScore,
    workText: day.workText,
    noteText: day.noteText,
  };
}

export function createReportSummaryInput(
  report: ReportData,
  includeLibraryComparison: boolean,
): ReportSummaryInput {
  return {
    target: {
      period: report.periods.target,
      metrics: report.targetMetrics,
      days: report.targetDays.map(dayInput),
    },
    comparison: {
      period: report.periods.comparison,
      metrics: report.comparisonMetrics,
      days: report.comparisonDays.map(dayInput),
    },
    comparisons: report.comparisons,
    libraries: includeLibraryComparison ? report.libraries : [],
    additionalContext: {},
  };
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value.trim() : null;
}

function dailySummary(value: unknown): ReportDailySummary | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const date = stringValue(record.date);
  const workSummary = stringValue(record.workSummary);
  const noteSummary = stringValue(record.noteSummary);
  if (date === null || workSummary === null || noteSummary === null) return null;
  return { date, workSummary, noteSummary };
}

export function parseReportSummary(value: unknown): ReportSummary {
  const candidate =
    typeof value === "object" && value !== null && "summary" in value
      ? (value as { summary: unknown }).summary
      : value;
  if (typeof candidate !== "object" || candidate === null) {
    throw new Error("要約レスポンスの形式が正しくありません。");
  }

  const record = candidate as Record<string, unknown>;
  const workSummary = stringValue(record.workSummary);
  const noteSummary = stringValue(record.noteSummary);
  const overview = stringValue(record.overview);
  const daily = Array.isArray(record.daily)
    ? record.daily.map(dailySummary)
    : null;
  if (
    workSummary === null ||
    noteSummary === null ||
    overview === null ||
    daily === null ||
    daily.some((item) => item === null)
  ) {
    throw new Error("要約レスポンスの形式が正しくありません。");
  }

  return {
    daily: daily as ReportDailySummary[],
    workSummary,
    noteSummary,
    overview,
  };
}

interface HttpReportSummarizerOptions {
  endpoint: string;
  model?: string;
  accessToken?: string;
  timeoutMilliseconds?: number;
}

/**
 * Provider-neutral HTTP adapter. The configured endpoint may be backed by
 * Gemini, a local model, or another provider without changing the report UI.
 */
export class HttpReportSummarizer implements ReportSummarizer {
  readonly #options: HttpReportSummarizerOptions;

  constructor(options: HttpReportSummarizerOptions) {
    this.#options = options;
  }

  async summarize(input: ReportSummaryInput): Promise<ReportSummary> {
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      this.#options.timeoutMilliseconds ?? 30_000,
    );

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (this.#options.accessToken) {
        headers.Authorization = `Bearer ${this.#options.accessToken}`;
      }
      const body: Record<string, unknown> = {
        instructions: SUMMARY_INSTRUCTIONS,
        input,
      };
      if (this.#options.model) body.model = this.#options.model;

      const response = await fetch(this.#options.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`要約サービスがエラーを返しました（${response.status}）。`);
      }
      return parseReportSummary(await response.json());
    } finally {
      window.clearTimeout(timeout);
    }
  }
}

export function createConfiguredReportSummarizer(
  accessToken?: string,
): ReportSummarizer | null {
  const endpoint = import.meta.env.VITE_REPORT_SUMMARIZER_ENDPOINT?.trim();
  if (!endpoint) return null;
  const model = import.meta.env.VITE_REPORT_SUMMARIZER_MODEL?.trim();
  return new HttpReportSummarizer({
    endpoint,
    ...(model ? { model } : {}),
    ...(accessToken ? { accessToken } : {}),
  });
}

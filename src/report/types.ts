export const REPORT_TITLE = "図書館作業レポート";

export type ReportOrientation = "landscape" | "portrait";

export interface ReportPeriod {
  startDate: string;
  endDate: string;
  days: number;
}

export interface ReportPeriods {
  target: ReportPeriod;
  comparison: ReportPeriod;
}

export interface ReportSessionRecord {
  libraryId: string;
  enteredAt: Date;
  exitedAt: Date;
  stayMinutes: number;
  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismScore: number;
  actualTaskText: string;
  note: string;
}

export interface DailyReportData {
  date: string;
  sessionCount: number;
  libraryIds: string[];
  libraryNames: string[];
  stayMinutes: number | null;
  concentrationScore: number | null;
  anxietyScore: number | null;
  fatigueScore: number | null;
  selfCriticismScore: number | null;
  workText: string;
  noteText: string;
}

export interface PeriodMetrics {
  hasSessions: boolean;
  workDays: number;
  totalStayMinutes: number;
  averageStayMinutes: number | null;
  concentrationScore: number | null;
  anxietyScore: number | null;
  fatigueScore: number | null;
  selfCriticismScore: number | null;
}

export interface LibraryReportData extends PeriodMetrics {
  libraryId: string;
  libraryName: string;
}

export type ChangeAssessment = "improved" | "worsened" | "unchanged";

export interface MetricComparison {
  difference: number | null;
  assessment: ChangeAssessment | null;
}

export interface ReportComparisons {
  workDays: MetricComparison;
  averageStayMinutes: MetricComparison;
  concentrationScore: MetricComparison;
  anxietyScore: MetricComparison;
  fatigueScore: MetricComparison;
  selfCriticismScore: MetricComparison;
}

export interface ReportData {
  periods: ReportPeriods;
  targetDays: DailyReportData[];
  comparisonDays: DailyReportData[];
  targetMetrics: PeriodMetrics;
  comparisonMetrics: PeriodMetrics;
  comparisons: ReportComparisons;
  libraries: LibraryReportData[];
}

export interface ReportSummaryDayInput {
  date: string;
  libraries: string[];
  stayMinutes: number | null;
  concentrationScore: number | null;
  anxietyScore: number | null;
  fatigueScore: number | null;
  selfCriticismScore: number | null;
  workText: string;
  noteText: string;
}

export interface ReportSummaryPeriodInput {
  period: ReportPeriod;
  metrics: PeriodMetrics;
  days: ReportSummaryDayInput[];
}

export interface ReportSummaryInput {
  target: ReportSummaryPeriodInput;
  comparison: ReportSummaryPeriodInput;
  comparisons: ReportComparisons;
  libraries: LibraryReportData[];
  /** Future integrations (for example sleep data) can be added here. */
  additionalContext: Record<string, unknown>;
}

export interface ReportDailySummary {
  date: string;
  workSummary: string;
  noteSummary: string;
}

export interface ReportSummary {
  daily: ReportDailySummary[];
  workSummary: string;
  noteSummary: string;
  overview: string;
}

export interface ReportPdfOptions {
  orientation: ReportOrientation;
  includeLibraryComparison: boolean;
  generatedAt: Date;
  summary: ReportSummary | null;
}

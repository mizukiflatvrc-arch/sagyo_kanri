import { toJstDateTimeLocal } from "../utils/date";
import {
  formatReportDate,
  formatReportDateLong,
  formatReportDuration,
  formatReportScore,
} from "../utils/report";
import {
  REPORT_TITLE,
  type ChangeAssessment,
  type DailyReportData,
  type MetricComparison,
  type ReportData,
  type ReportPdfOptions,
  type ReportSummary,
} from "./types";

type PdfNode = string | Record<string, unknown>;

const COLORS = {
  ink: "#22312b",
  muted: "#5f6d67",
  line: "#c8d1cc",
  header: "#eaf2ee",
  soft: "#f6f8f7",
  good: "#236b4a",
  bad: "#9b3f38",
} as const;

function formatGeneratedAt(value: Date): string {
  const local = toJstDateTimeLocal(value);
  if (local === "") return "-";
  return `${formatReportDateLong(local.slice(0, 10))} ${local.slice(11)}`;
}

function signed(value: number, digits: number): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "-" : "±";
  return `${sign}${Math.abs(rounded).toFixed(digits)}`;
}

function assessmentText(value: ChangeAssessment | null): string {
  if (value === "improved") return "改善";
  if (value === "worsened") return "悪化";
  if (value === "unchanged") return "ほぼ変化なし";
  return "";
}

function assessmentColor(value: ChangeAssessment | null): string {
  if (value === "improved") return COLORS.good;
  if (value === "worsened") return COLORS.bad;
  return COLORS.muted;
}

function comparisonText(
  comparison: MetricComparison,
  kind: "days" | "duration" | "score",
): string {
  if (comparison.difference === null) return "前期間比 -";
  if (comparison.assessment === "unchanged") {
    return "前期間比 ほぼ変化なし";
  }

  let difference: string;
  if (kind === "days") {
    const rounded = Math.round(comparison.difference);
    const prefix = rounded > 0 ? "+" : rounded < 0 ? "-" : "±";
    difference = `${prefix}${Math.abs(rounded)}日`;
  } else if (kind === "duration") {
    const rounded = Math.round(comparison.difference);
    const prefix = rounded > 0 ? "+" : rounded < 0 ? "-" : "±";
    difference = `${prefix}${formatReportDuration(Math.abs(rounded))}`;
  } else {
    difference = signed(comparison.difference, 1);
  }
  const assessment = assessmentText(comparison.assessment);
  return `前期間比 ${difference}${assessment ? ` ${assessment}` : ""}`;
}

function summaryMetricCell(
  label: string,
  value: string,
  comparison: MetricComparison,
  kind: "days" | "duration" | "score",
  compact: boolean,
): PdfNode {
  return {
    stack: [
      {
        text: label,
        bold: true,
        fontSize: compact ? 6.8 : 8.5,
        color: COLORS.muted,
        alignment: "center",
        margin: [0, 0, 0, 4],
      },
      {
        text: value,
        bold: true,
        fontSize: compact ? 10 : 13,
        color: COLORS.ink,
        alignment: "center",
        margin: [0, 0, 0, 4],
      },
      {
        text: comparisonText(comparison, kind),
        fontSize: compact ? 5.8 : 7.2,
        color: assessmentColor(comparison.assessment),
        alignment: "center",
      },
    ],
    fillColor: COLORS.soft,
    margin: compact ? [2, 7, 2, 7] : [4, 8, 4, 8],
  };
}

function summaryTable(report: ReportData, compact: boolean): PdfNode {
  const metrics = report.targetMetrics;
  const comparisons = report.comparisons;
  return {
    table: {
      widths: ["*", "*", "*", "*", "*", "*"],
      body: [[
        summaryMetricCell(
          "作業日数",
          `${metrics.workDays}日`,
          comparisons.workDays,
          "days",
          compact,
        ),
        summaryMetricCell(
          "平均滞在時間",
          formatReportDuration(metrics.averageStayMinutes),
          comparisons.averageStayMinutes,
          "duration",
          compact,
        ),
        summaryMetricCell(
          "集中度",
          formatReportScore(metrics.concentrationScore),
          comparisons.concentrationScore,
          "score",
          compact,
        ),
        summaryMetricCell(
          "焦り・不安",
          formatReportScore(metrics.anxietyScore),
          comparisons.anxietyScore,
          "score",
          compact,
        ),
        summaryMetricCell(
          "疲労度",
          formatReportScore(metrics.fatigueScore),
          comparisons.fatigueScore,
          "score",
          compact,
        ),
        summaryMetricCell(
          "自己否定",
          formatReportScore(metrics.selfCriticismScore),
          comparisons.selfCriticismScore,
          "score",
          compact,
        ),
      ]],
    },
    layout: {
      hLineColor: () => COLORS.line,
      vLineColor: () => COLORS.line,
      hLineWidth: () => 0.7,
      vLineWidth: () => 0.7,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    margin: [0, 0, 0, 14],
  };
}

function sectionTitle(text: string): PdfNode {
  return {
    text,
    bold: true,
    fontSize: 11,
    color: COLORS.ink,
    margin: [0, 7, 0, 5],
    headlineLevel: 1,
  };
}

function summarySections(summary: ReportSummary): PdfNode[] {
  return [
    {
      table: {
        widths: ["*", "*"],
        body: [[
          {
            stack: [
              { text: "やったこと要約", bold: true, margin: [0, 0, 0, 4] },
              { text: summary.workSummary || "-" },
            ],
            margin: [8, 7, 8, 8],
          },
          {
            stack: [
              { text: "メモ要約", bold: true, margin: [0, 0, 0, 4] },
              { text: summary.noteSummary || "-" },
            ],
            margin: [8, 7, 8, 8],
          },
        ]],
      },
      layout: {
        hLineColor: () => COLORS.line,
        vLineColor: () => COLORS.line,
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
      },
      margin: [0, 0, 0, 8],
    },
    {
      table: {
        widths: ["*"],
        body: [[{
          stack: [
            { text: "統括", bold: true, margin: [0, 0, 0, 4] },
            { text: summary.overview || "-" },
          ],
          margin: [8, 7, 8, 8],
          fillColor: COLORS.soft,
        }]],
      },
      layout: {
        hLineColor: () => COLORS.line,
        vLineColor: () => COLORS.line,
        hLineWidth: () => 0.7,
        vLineWidth: () => 0.7,
      },
      margin: [0, 0, 0, 8],
    },
  ];
}

function libraryTable(report: ReportData, compact: boolean): PdfNode[] {
  const header = [
    "図書館",
    "作業日数",
    "平均滞在",
    "集中度",
    "焦り・不安",
    "疲労度",
    "自己否定",
  ].map((text) => ({ text, bold: true, fillColor: COLORS.header }));
  const rows = report.libraries.map((library) => [
    library.libraryName,
    `${library.workDays}日`,
    formatReportDuration(library.averageStayMinutes),
    formatReportScore(library.concentrationScore),
    formatReportScore(library.anxietyScore),
    formatReportScore(library.fatigueScore),
    formatReportScore(library.selfCriticismScore),
  ]);

  return [
    sectionTitle("図書館比較"),
    report.libraries.length === 0
      ? { text: "対象期間に図書館の利用記録はありません。", color: COLORS.muted }
      : {
          table: {
            headerRows: 1,
            widths: compact
              ? ["*", 37, 55, 32, 38, 32, 38]
              : ["*", 48, 72, 43, 52, 43, 52],
            body: [header, ...rows],
          },
          layout: "lightHorizontalLines",
          fontSize: compact ? 6.8 : 8,
          margin: [0, 0, 0, 9],
        },
  ];
}

function dailyText(
  day: DailyReportData,
  summaryByDate: ReadonlyMap<string, { workSummary: string; noteSummary: string }>,
) {
  const summary = day.sessionCount > 0 ? summaryByDate.get(day.date) : undefined;
  return {
    work: summary?.workSummary || day.workText,
    note: summary?.noteSummary || day.noteText,
  };
}

function dailyTable(
  report: ReportData,
  summary: ReportSummary | null,
  compact: boolean,
): PdfNode {
  const summaryByDate = new Map(
    (summary?.daily ?? []).map((day) => [day.date, day]),
  );
  const header = [
    "日付",
    "図書館",
    "滞在時間",
    "集中度",
    "焦り・不安",
    "疲労度",
    "自己否定",
  ].map((text) => ({
    text,
    bold: true,
    fillColor: COLORS.header,
    alignment: "center",
  }));

  const widths = compact
    ? [31, "*", 48, 30, 38, 30, 38]
    : [37, "*", 62, 41, 50, 41, 50];
  const innerLayout = {
    hLineColor: () => COLORS.line,
    vLineColor: () => COLORS.line,
    hLineWidth: () => 0.55,
    vLineWidth: () => 0.55,
    paddingLeft: () => compact ? 3 : 5,
    paddingRight: () => compact ? 3 : 5,
    paddingTop: () => 4,
    paddingBottom: () => 4,
  };
  const rows: PdfNode[][] = [[{
    table: { widths, body: [header] },
    layout: innerLayout,
  }]];
  report.targetDays.forEach((day) => {
    const text = dailyText(day, summaryByDate);
    rows.push([
      {
        table: {
          widths,
          body: [
            [
              {
                text: formatReportDate(day.date),
                bold: true,
                alignment: "center",
                rowSpan: 2,
              },
              day.libraryNames.length > 0 ? day.libraryNames.join(" / ") : "-",
              day.stayMinutes === null ? "-" : formatReportDuration(day.stayMinutes),
              formatReportScore(day.concentrationScore),
              formatReportScore(day.anxietyScore),
              formatReportScore(day.fatigueScore),
              formatReportScore(day.selfCriticismScore),
            ],
            [
              "",
              {
                colSpan: 6,
                stack: [
                  { text: [{ text: "やったこと：", bold: true }, text.work] },
                  {
                    text: [{ text: "メモ：", bold: true }, text.note],
                    margin: [0, 3, 0, 0],
                  },
                ],
                fillColor: COLORS.soft,
              },
              "",
              "",
              "",
              "",
              "",
            ],
          ],
          dontBreakRows: true,
        },
        layout: innerLayout,
      },
    ]);
  });

  return {
    table: {
      headerRows: 1,
      widths: ["*"],
      body: rows,
      dontBreakRows: true,
    },
    layout: {
      hLineWidth: () => 0,
      vLineWidth: () => 0,
      paddingLeft: () => 0,
      paddingRight: () => 0,
      paddingTop: () => 0,
      paddingBottom: () => 0,
    },
    fontSize: compact ? 6.4 : 7.8,
  };
}

export function buildReportDocumentDefinition(
  report: ReportData,
  options: ReportPdfOptions,
): Record<string, unknown> {
  const compact = options.orientation === "portrait";
  const content: PdfNode[] = [
    {
      text: REPORT_TITLE,
      bold: true,
      fontSize: 22,
      color: COLORS.ink,
      margin: [0, 0, 0, 7],
    },
    {
      text: `対象期間：${formatReportDateLong(report.periods.target.startDate)}〜${formatReportDateLong(report.periods.target.endDate)}`,
      fontSize: 14,
      color: COLORS.ink,
      margin: [0, 0, 0, 3],
    },
    {
      text: `作成日時：${formatGeneratedAt(options.generatedAt)}`,
      fontSize: 8.5,
      color: COLORS.muted,
    },
    {
      text: `比較期間：${formatReportDateLong(report.periods.comparison.startDate)}〜${formatReportDateLong(report.periods.comparison.endDate)}`,
      fontSize: 7.5,
      color: COLORS.muted,
      margin: [0, 1, 0, 12],
    },
    summaryTable(report, compact),
  ];

  if (options.summary) content.push(...summarySections(options.summary));
  if (options.includeLibraryComparison) {
    content.push(...libraryTable(report, compact));
  }
  content.push(sectionTitle("日別詳細"));
  content.push(dailyTable(report, options.summary, compact));

  return {
    info: {
      title: REPORT_TITLE,
      subject: "図書館での作業記録",
    },
    pageSize: "A4",
    pageOrientation: options.orientation,
    pageMargins: compact ? [25, 30, 25, 34] : [30, 32, 30, 34],
    footer: (currentPage: number, pageCount: number) => ({
      text: `${currentPage} / ${pageCount}`,
      alignment: "right",
      margin: [0, 9, compact ? 25 : 30, 0],
      fontSize: 7.5,
      color: COLORS.muted,
    }),
    content,
    defaultStyle: {
      font: "NotoSansJP",
      fontSize: compact ? 7.4 : 8.5,
      lineHeight: 1.35,
      color: COLORS.ink,
    },
    pageBreakBefore: (
      currentNode: { headlineLevel?: number },
      nodeContainer: { getFollowingNodesOnPage(): unknown[] },
    ) =>
      currentNode.headlineLevel === 1 &&
      nodeContainer.getFollowingNodesOnPage().length === 0,
  };
}

function fontUrl(): string {
  const relativePath = `${import.meta.env.BASE_URL}fonts/NotoSansJP.ttf`;
  return new URL(relativePath, window.location.origin).href;
}

export async function createReportPdfBlob(
  report: ReportData,
  options: ReportPdfOptions,
): Promise<Blob> {
  const { default: pdfMake } = await import("pdfmake/build/pdfmake.js");
  const url = fontUrl();
  pdfMake.setUrlAccessPolicy((resourceUrl) => {
    try {
      return new URL(resourceUrl).origin === window.location.origin;
    } catch {
      return false;
    }
  });
  pdfMake.addFonts({
    NotoSansJP: {
      normal: url,
      bold: url,
      italics: url,
      bolditalics: url,
    },
  });
  return pdfMake.createPdf(buildReportDocumentDefinition(report, options)).getBlob();
}

export function reportPdfFilename(report: ReportData): string {
  return `hibi_report_${report.periods.target.startDate}_${report.periods.target.endDate}.pdf`;
}

export function downloadPdfBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

import { describe, expect, it } from "vitest";
import { calculateReportPeriods, createReportData } from "../utils/report";
import type { ReportSessionRecord, ReportSummary } from "./types";
import {
  buildReportDocumentDefinition,
  reportPdfFilename,
} from "./pdf";

const session: ReportSessionRecord = {
  libraryId: "central",
  enteredAt: new Date("2026-09-06T01:00:00.000Z"),
  exitedAt: new Date("2026-09-06T03:00:00.000Z"),
  stayMinutes: 120,
  concentrationScore: 7,
  anxietyScore: 3,
  fatigueScore: 5,
  selfCriticismScore: 2,
  actualTaskText: "PDF実装を進めた。",
  note: "落ち着いて作業できた。",
};

function report() {
  return createReportData(
    [session],
    calculateReportPeriods("2026-09-07", 7)!,
    new Map([["central", "中央図書館"]]),
  );
}

const summary: ReportSummary = {
  daily: [
    {
      date: "2026-09-06",
      workSummary: "PDF実装を行った。",
      noteSummary: "安定していた。",
    },
  ],
  workSummary: "PDF実装を進めた。",
  noteSummary: "安定した記録だった。",
  overview: "前期間との比較を含む統括。",
};

describe("buildReportDocumentDefinition", () => {
  it.each(["landscape", "portrait"] as const)(
    "A4 %s の文書と全ページ用フッターを作る",
    (orientation) => {
      const definition = buildReportDocumentDefinition(report(), {
        orientation,
        includeLibraryComparison: true,
        generatedAt: new Date("2026-09-07T13:36:00.000Z"),
        summary,
      });
      expect(definition.pageSize).toBe("A4");
      expect(definition.pageOrientation).toBe(orientation);
      expect(definition.defaultStyle).toMatchObject({ font: "NotoSansJP" });
      const footer = definition.footer as (
        currentPage: number,
        pageCount: number,
      ) => { text: string };
      expect(footer(2, 4).text).toBe("2 / 4");
      expect(JSON.stringify(definition.content)).toContain("図書館作業レポート");
      expect(JSON.stringify(definition.content)).toContain(
        "作成日時：2026/9/7 22:36",
      );
      expect(JSON.stringify(definition.content)).toContain("図書館比較");
      expect(JSON.stringify(definition.content)).toContain("統括");
    },
  );

  it("LLM OFF・図書館比較OFFでは各任意セクションを出力しない", () => {
    const definition = buildReportDocumentDefinition(report(), {
      orientation: "landscape",
      includeLibraryComparison: false,
      generatedAt: new Date("2026-09-07T13:36:00.000Z"),
      summary: null,
    });
    const content = JSON.stringify(definition.content);
    expect(content).not.toContain("やったこと要約");
    expect(content).not.toContain("図書館比較");
    expect(content).toContain("PDF実装を進めた。");
    expect(content).toContain("日別詳細");
  });
});

it("対象期間入りのファイル名を作る", () => {
  expect(reportPdfFilename(report())).toBe(
    "hibi_report_2026-09-01_2026-09-07.pdf",
  );
});

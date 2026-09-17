import { describe, expect, it } from "vitest";
import { calculateReportPeriods, createReportData } from "../utils/report";
import type { ReportSessionRecord } from "./types";
import {
  createReportSummaryInput,
  parseReportSummary,
} from "./summarizer";

function record(date: string, workText: string): ReportSessionRecord {
  return {
    libraryId: "central",
    enteredAt: new Date(`${date}T01:00:00.000Z`),
    exitedAt: new Date(`${date}T03:00:00.000Z`),
    stayMinutes: 120,
    concentrationScore: 7,
    anxietyScore: 3,
    fatigueScore: 5,
    selfCriticismScore: 2,
    actualTaskText: workText,
    note: `${workText}のメモ`,
  };
}

describe("createReportSummaryInput", () => {
  it("対象・比較期間の全日別データと任意の図書館集計を渡す", () => {
    const periods = calculateReportPeriods("2026-09-07", 7)!;
    const report = createReportData(
      [
        record("2026-09-06", "対象作業"),
        record("2026-08-30", "比較作業"),
      ],
      periods,
      new Map([["central", "中央図書館"]]),
    );

    const input = createReportSummaryInput(report, true);
    expect(input.target.days).toHaveLength(7);
    expect(input.comparison.days).toHaveLength(7);
    expect(input.target.days.find((day) => day.workText === "対象作業"))
      .toMatchObject({ libraries: ["中央図書館"], stayMinutes: 120 });
    expect(input.comparison.days.find((day) => day.workText === "比較作業"))
      .toBeDefined();
    expect(input.libraries).toHaveLength(1);
    expect(input.additionalContext).toEqual({});
  });

  it("図書館比較OFFなら図書館集計を入力から除外する", () => {
    const periods = calculateReportPeriods("2026-09-07", 7)!;
    const report = createReportData(
      [record("2026-09-06", "対象作業")],
      periods,
      new Map([["central", "中央図書館"]]),
    );
    expect(createReportSummaryInput(report, false).libraries).toEqual([]);
  });
});

describe("parseReportSummary", () => {
  const valid = {
    daily: [
      {
        date: "2026-09-06",
        workSummary: "実装を進めた。",
        noteSummary: "比較的安定していた。",
      },
    ],
    workSummary: "期間中は実装を進めた。",
    noteSummary: "安定した日が多かった。",
    overview: "前期間より集中度が高かった。",
  };

  it("構造化されたレスポンスを検証する", () => {
    expect(parseReportSummary({ summary: valid })).toEqual(valid);
  });

  it.each([
    null,
    {},
    { ...valid, overview: 3 },
    { ...valid, daily: [{ date: "2026-09-06" }] },
  ])("不正な構造を拒否する", (value) => {
    expect(() => parseReportSummary(value)).toThrow("形式");
  });
});

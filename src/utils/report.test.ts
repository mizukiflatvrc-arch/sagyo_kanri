import { describe, expect, it } from "vitest";
import type { PeriodMetrics, ReportSessionRecord } from "../report/types";
import {
  aggregateLibraries,
  aggregatePeriodMetrics,
  aggregateReportDays,
  calculateReportPeriods,
  comparePeriodMetrics,
  createReportData,
  formatReportDuration,
} from "./report";

function session(
  enteredAt: string,
  overrides: Partial<ReportSessionRecord> = {},
): ReportSessionRecord {
  return {
    libraryId: "central",
    enteredAt: new Date(enteredAt),
    exitedAt: new Date(new Date(enteredAt).getTime() + 60 * 60_000),
    stayMinutes: 60,
    concentrationScore: 6,
    anxietyScore: 4,
    fatigueScore: 5,
    selfCriticismScore: 3,
    actualTaskText: "仕様を整理した。",
    note: "落ち着いていた。",
    ...overrides,
  };
}

const TARGET_PERIOD = {
  startDate: "2026-09-01",
  endDate: "2026-09-07",
  days: 7,
};

describe("calculateReportPeriods", () => {
  it("対象日を含む7日と直前の7日をJST日付で計算する", () => {
    expect(calculateReportPeriods("2026-09-07", 7)).toEqual({
      target: TARGET_PERIOD,
      comparison: {
        startDate: "2026-08-25",
        endDate: "2026-08-31",
        days: 7,
      },
    });
  });

  it.each([0, -1, 1.5, Number.NaN])("不正な日数 %s を拒否する", (days) => {
    expect(calculateReportPeriods("2026-09-07", days)).toBeNull();
  });
});

describe("daily and period aggregation", () => {
  const records = [
    session("2026-09-05T01:00:00.000Z", {
      stayMinutes: 60,
      concentrationScore: 8,
      anxietyScore: 6,
      fatigueScore: 4,
      selfCriticismScore: 6,
      actualTaskText: "仕様整理をした。",
      note: "午前のメモ。",
    }),
    session("2026-09-05T04:00:00.000Z", {
      libraryId: "university",
      stayMinutes: 180,
      concentrationScore: 4,
      anxietyScore: 2,
      fatigueScore: 7,
      selfCriticismScore: 2,
      actualTaskText: "実装とテストを進めた。",
      note: "午後のメモ。",
    }),
  ];
  const names = new Map([
    ["central", "中央図書館"],
    ["university", "大学図書館"],
  ]);

  it("同日複数セッションを1日へ集約し、疲労だけ最後の値を使う", () => {
    const days = aggregateReportDays(records, TARGET_PERIOD, names);
    const day = days.find((candidate) => candidate.date === "2026-09-05");

    expect(days).toHaveLength(7);
    expect(day).toMatchObject({
      sessionCount: 2,
      libraryNames: ["中央図書館", "大学図書館"],
      stayMinutes: 240,
      concentrationScore: 5,
      anxietyScore: 3,
      fatigueScore: 7,
      selfCriticismScore: 3,
      workText: "仕様整理をした。 / 実装とテストを進めた。",
      noteText: "午前のメモ。 / 午後のメモ。",
    });
    expect(aggregatePeriodMetrics(days)).toMatchObject({
      hasSessions: true,
      workDays: 1,
      totalStayMinutes: 240,
      averageStayMinutes: 240,
      concentrationScore: 5,
      anxietyScore: 3,
      fatigueScore: 7,
      selfCriticismScore: 3,
    });
  });

  it("作業なしの日を削除せず、値と文章をハイフン相当に保つ", () => {
    const empty = aggregateReportDays([], TARGET_PERIOD, names);
    expect(empty).toHaveLength(7);
    expect(empty[0]).toMatchObject({
      date: "2026-09-01",
      sessionCount: 0,
      stayMinutes: null,
      concentrationScore: null,
      fatigueScore: null,
      workText: "-",
      noteText: "-",
    });
  });

  it("図書館別に各セッションを帰属させ、日数と平均を再集約する", () => {
    const libraries = aggregateLibraries(records, TARGET_PERIOD, names);
    expect(libraries).toHaveLength(2);
    expect(libraries[0]).toMatchObject({
      libraryId: "university",
      libraryName: "大学図書館",
      workDays: 1,
      totalStayMinutes: 180,
      averageStayMinutes: 180,
      concentrationScore: 4,
      fatigueScore: 7,
    });
    expect(libraries[1]).toMatchObject({
      libraryId: "central",
      libraryName: "中央図書館",
      workDays: 1,
      totalStayMinutes: 60,
      averageStayMinutes: 60,
      concentrationScore: 8,
      fatigueScore: 4,
    });
  });
});

describe("period comparison", () => {
  function metrics(overrides: Partial<PeriodMetrics>): PeriodMetrics {
    return {
      hasSessions: true,
      workDays: 3,
      totalStayMinutes: 360,
      averageStayMinutes: 120,
      concentrationScore: 5,
      anxietyScore: 5,
      fatigueScore: 5,
      selfCriticismScore: 5,
      ...overrides,
    };
  }

  it("集中度は増加を改善、他の状態スコアは減少を改善とする", () => {
    const comparison = comparePeriodMetrics(
      metrics({
        concentrationScore: 6,
        anxietyScore: 4,
        fatigueScore: 6,
        selfCriticismScore: 4,
      }),
      metrics({}),
    );
    expect(comparison.concentrationScore.assessment).toBe("improved");
    expect(comparison.anxietyScore.assessment).toBe("improved");
    expect(comparison.fatigueScore.assessment).toBe("worsened");
    expect(comparison.selfCriticismScore.assessment).toBe("improved");
    expect(comparison.workDays.assessment).toBeNull();
    expect(comparison.averageStayMinutes.assessment).toBeNull();
  });

  it.each([0.2, -0.2, 0])("差分 %s をほぼ変化なしとする", (difference) => {
    const comparison = comparePeriodMetrics(
      metrics({ concentrationScore: 5 + difference }),
      metrics({ concentrationScore: 5 }),
    );
    expect(comparison.concentrationScore.assessment).toBe("unchanged");
  });

  it("比較期間に作業がなければ全差分を計算不能にする", () => {
    const comparison = comparePeriodMetrics(
      metrics({}),
      metrics({ hasSessions: false, workDays: 0 }),
    );
    expect(Object.values(comparison).every((value) => value.difference === null))
      .toBe(true);
  });

  it("対象期間と比較期間を1つのReportDataへ構成する", () => {
    const periods = calculateReportPeriods("2026-09-07", 7);
    expect(periods).not.toBeNull();
    const report = createReportData(
      [
        session("2026-09-06T01:00:00.000Z"),
        session("2026-08-30T01:00:00.000Z", { concentrationScore: 4 }),
      ],
      periods!,
      new Map([["central", "中央図書館"]]),
    );
    expect(report.targetMetrics.workDays).toBe(1);
    expect(report.comparisonMetrics.workDays).toBe(1);
    expect(report.comparisons.concentrationScore).toMatchObject({
      difference: 2,
      assessment: "improved",
    });
  });
});

describe("formatReportDuration", () => {
  it.each([
    [0, "0分"],
    [18, "18分"],
    [200, "3時間20分"],
    [199.6, "3時間20分"],
    [null, "-"],
  ])("%s を %s で表示する", (value, expected) => {
    expect(formatReportDuration(value)).toBe(expected);
  });
});

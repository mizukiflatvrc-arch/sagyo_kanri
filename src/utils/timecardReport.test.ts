import { describe, expect, it } from "vitest";
import {
  parseTimecardReport,
  validateTimecardReport,
  type TimecardReportFormValues,
} from "./timecardReport";

function validValues(): TimecardReportFormValues {
  return {
    libraryId: "library-1",
    enteredAt: "2026-07-31T10:00",
    exitedAt: "2026-07-31T12:00",
    concentrationScore: 6,
    anxietyScore: 4,
    fatigueScore: 5,
    selfCriticismScore: 2,
    plannedTaskCreated: true,
    plannedTaskText: "資料を読む",
    actualTaskText: "資料を読んだ",
    completionStatus: "mostly_on_schedule",
    note: "",
  };
}

describe("validateTimecardReport", () => {
  it("入退室日時から滞在分数を計算して解析する", () => {
    expect(parseTimecardReport(validValues())).toMatchObject({
      stayMinutes: 120,
      selfCriticismScore: 2,
    });
  });

  it.each([
    ["同時刻", "2026-07-31T10:00"],
    ["1分未満", "2026-07-31T10:00:30"],
    ["逆転", "2026-07-31T09:59"],
  ])("%sの退出日時を拒否する", (_label, exitedAt) => {
    const values = { ...validValues(), exitedAt };
    expect(validateTimecardReport(values).exitedAt).toBeDefined();
    expect(parseTimecardReport(values)).toBeNull();
  });

  it.each([
    ["concentrationScore", -1],
    ["anxietyScore", 11],
    ["fatigueScore", 1.5],
    ["selfCriticismScore", 11],
  ] as const)("スコア %s の範囲と整数性を検証する", (field, value) => {
    expect(
      validateTimecardReport({ ...validValues(), [field]: value })[field],
    ).toBeDefined();
  });

  it("図書館を必須にする", () => {
    expect(
      validateTimecardReport({ ...validValues(), libraryId: " " }).libraryId,
    ).toBeDefined();
  });

  it("無効な日時でもクラッシュしない", () => {
    expect(() =>
      validateTimecardReport({
        ...validValues(),
        enteredAt: "invalid",
        exitedAt: "also-invalid",
      }),
    ).not.toThrow();
  });
});

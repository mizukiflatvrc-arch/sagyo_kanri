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

  it("予定なし(not_planned)の終了状況を受け入れる", () => {
    const values = { ...validValues(), plannedTaskText: "", completionStatus: "not_planned" as const };
    expect(validateTimecardReport(values).completionStatus).toBeUndefined();
    expect(parseTimecardReport(values)?.completionStatus).toBe("not_planned");
  });

  it("予定タスクが空の場合はplannedTaskCreatedをfalseにする", () => {
    const values = {
      ...validValues(),
      plannedTaskText: "  ",
      actualTaskText: "コードを書いた",
    };
    const parsed = parseTimecardReport(values);
    expect(parsed?.plannedTaskCreated).toBe(false);
    expect(parsed?.plannedTaskText).toBe("");
    expect(parsed?.completionStatus).toBe("not_planned");
    expect(parsed?.actualTaskText).toBe("コードを書いた");
  });

  it("予定タスクが入力されている場合はplannedTaskCreatedをtrueにする", () => {
    const values = {
      ...validValues(),
      plannedTaskText: "設計書レビュー",
    };
    const parsed = parseTimecardReport(values);
    expect(parsed?.plannedTaskCreated).toBe(true);
    expect(parsed?.plannedTaskText).toBe("設計書レビュー");
  });

  it("actualTaskTextが空でもバリデーションエラーにならない（任意）", () => {
    const values = {
      ...validValues(),
      actualTaskText: "",
    };
    expect(validateTimecardReport(values)).toEqual({});
    expect(parseTimecardReport(values)?.actualTaskText).toBe("");
  });

  it("予定ありでnot_plannedのままなら終了状況の選択を求める", () => {
    const values = { ...validValues(), completionStatus: "not_planned" as const };
    expect(validateTimecardReport(values).completionStatus).toBeDefined();
    expect(parseTimecardReport(values)).toBeNull();
  });
});

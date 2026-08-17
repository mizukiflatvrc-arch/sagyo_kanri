import { describe, expect, it } from "vitest";
import { createJstDateRange } from "./date";
import {
  EXPORT_TABLE_HEADERS,
  formatExportJstDate,
  formatExportJstTime,
  formatMinutesAsClock,
  createExportTableRows,
  generateSessionsMarkdown,
  type ExportSessionRecord,
} from "./export";

function session(
  enteredAt: string,
  overrides: Partial<ExportSessionRecord> = {},
): ExportSessionRecord {
  return {
    enteredAt: new Date(enteredAt),
    exitedAt: new Date(new Date(enteredAt).getTime() + 90 * 60_000),
    stayMinutes: 90,
    concentrationScore: 7,
    anxietyScore: 4,
    fatigueScore: 6,
    selfCriticismScore: 3,
    ...overrides,
  };
}

describe("formatMinutesAsClock", () => {
  it.each([
    [0, "00:00"],
    [5, "00:05"],
    [60, "01:00"],
    [90, "01:30"],
    [1500, "25:00"],
  ])("%s分を%sへ変換する", (minutes, expected) => {
    expect(formatMinutesAsClock(minutes)).toBe(expected);
  });

  it.each([-1, 1.5, Number.NaN, null, undefined, "60"])(
    "負数や不正値を安全に処理する",
    (value) => {
      expect(formatMinutesAsClock(value)).toBe("-");
    },
  );
});

describe("JST export formatting", () => {
  it("UTCの瞬間を日本時間のMM/DDとHH:mmへ変換する", () => {
    const instant = new Date("2026-07-02T15:05:00.000Z");
    expect(formatExportJstDate(instant)).toBe("07/03");
    expect(formatExportJstTime(instant)).toBe("00:05");
  });

  it("UTCから日本時間へ変換したときに作業日がずれない", () => {
    const instant = new Date("2026-07-28T01:15:00.000Z");
    expect(formatExportJstDate(instant)).toBe("07/28");
    expect(formatExportJstTime(instant)).toBe("10:15");
  });

  it.each([new Date(Number.NaN), null, undefined, "invalid"])(
    "無効値でクラッシュせずハイフンを返す",
    (value) => {
      expect(formatExportJstDate(value)).toBe("-");
      expect(formatExportJstTime(value)).toBe("-");
    },
  );
});

describe("generateSessionsMarkdown", () => {
  it("指定されたヘッダー、区切り、列順で生成する", () => {
    const markdown = generateSessionsMarkdown([
      session("2026-07-28T01:15:00.000Z", {
        exitedAt: new Date("2026-07-28T03:30:00.000Z"),
        stayMinutes: 135,
      }),
    ]);
    const lines = markdown.split("\n");

    expect(lines[0]).toBe(`| ${EXPORT_TABLE_HEADERS.join(" | ")} |`);
    expect(lines[1]).toBe(
      "|---|---:|---:|---:|---:|---:|---:|---:|",
    );
    expect(lines[2]).toBe(
      "| 07/28 | 10:15 | 12:30 | 02:15 | 7 | 4 | 6 | 3 |",
    );
  });

  it("複数レコードをenteredAtの昇順に並べる", () => {
    const markdown = generateSessionsMarkdown([
      session("2026-07-03T01:00:00.000Z"),
      session("2026-07-01T01:00:00.000Z"),
    ]);
    const dataLines = markdown.split("\n").slice(2);

    expect(dataLines[0]).toContain("| 07/01 |");
    expect(dataLines[1]).toContain("| 07/03 |");
  });

  it("指定期間の未登録日を---で補完する", () => {
    const rows = createExportTableRows(
      [session("2026-07-02T01:00:00.000Z")],
      { startDate: "2026-07-01", endDate: "2026-07-03" },
    );

    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({
      workDate: "07/01",
      enteredTime: "---",
      exitedTime: "---",
      stayDuration: "---",
      concentrationScore: "---",
      anxietyScore: "---",
      fatigueScore: "---",
      selfCriticismScore: "---",
    });
    expect(rows[1]?.workDate).toBe("07/02");
    expect(rows[1]?.enteredTime).toBe("10:00");
    expect(rows[2]?.workDate).toBe("07/03");
    expect(rows[2]?.enteredTime).toBe("---");
  });

  it("同じ日に複数記録がある場合はすべての行を残す", () => {
    const rows = createExportTableRows(
      [
        session("2026-07-02T04:00:00.000Z"),
        session("2026-07-02T01:00:00.000Z"),
      ],
      { startDate: "2026-07-01", endDate: "2026-07-03" },
    );

    expect(rows.map((row) => row.workDate)).toEqual([
      "07/01",
      "07/02",
      "07/02",
      "07/03",
    ]);
    expect(rows[1]?.enteredTime).toBe("10:00");
    expect(rows[2]?.enteredTime).toBe("13:00");
  });

  it("記録が0件でも指定期間のMarkdown行を生成する", () => {
    const markdown = generateSessionsMarkdown([], {
      startDate: "2026-07-01",
      endDate: "2026-07-02",
    });

    expect(markdown.split("\n").slice(2)).toEqual([
      "| 07/01 | --- | --- | --- | --- | --- | --- | --- |",
      "| 07/02 | --- | --- | --- | --- | --- | --- | --- |",
    ]);
  });

  it("自己否定の割合を0〜10のスコアで表示する", () => {
    expect(
      generateSessionsMarkdown([
        session("2026-07-28T01:15:00.000Z", {
          selfCriticismScore: 8,
        }),
      ]).split("\n")[2],
    ).toBe(
      "| 07/28 | 10:15 | 11:45 | 01:30 | 7 | 4 | 6 | 8 |",
    );
  });

  it("不要フィールドを出力しない", () => {
    const record = {
      ...session("2026-07-28T01:15:00.000Z"),
      actualWorkMinutes: 777,
      userId: "secret-user",
      libraryId: "secret-library",
      note: "private-note",
      plannedTaskText: "private-plan",
      actualTaskText: "private-work",
      nextDayNote: "private-next-day",
    };
    const markdown = generateSessionsMarkdown([record]);

    expect(markdown).not.toContain("secret-user");
    expect(markdown).not.toContain("secret-library");
    expect(markdown).not.toContain("private-");
    expect(markdown).not.toContain("実作業時間");
    expect(markdown).not.toContain("12:57");
  });

  it("0件を空文字列として安全に扱う", () => {
    expect(generateSessionsMarkdown([])).toBe("");
  });
});

describe("createJstDateRange", () => {
  it("開始日00:00以上、終了翌日00:00未満のJST範囲を作る", () => {
    const range = createJstDateRange("2026-07-01", "2026-07-31");

    expect(range?.start.toISOString()).toBe("2026-06-30T15:00:00.000Z");
    expect(range?.endExclusive.toISOString()).toBe(
      "2026-07-31T15:00:00.000Z",
    );
    expect(range?.start.getTime()).toBeLessThanOrEqual(
      new Date("2026-06-30T15:00:00.000Z").getTime(),
    );
    expect(
      new Date("2026-07-31T14:59:59.999Z").getTime(),
    ).toBeLessThan(range?.endExclusive.getTime() ?? 0);
  });

  it("同じ日を指定した場合もその日全体を含める", () => {
    const range = createJstDateRange("2026-07-03", "2026-07-03");
    expect(range?.endExclusive.getTime() ?? 0).toBe(
      (range?.start.getTime() ?? 0) + 24 * 60 * 60 * 1000,
    );
  });

  it.each([
    ["2026-07-31", "2026-07-01"],
    ["", "2026-07-01"],
    ["2026-02-30", "2026-03-01"],
  ])("逆転または不正な期間を拒否する", (startDate, endDate) => {
    expect(createJstDateRange(startDate, endDate)).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import {
  calculateActiveSessionStayMinutes,
  formatActiveSessionElapsed,
  isActiveSessionFromPreviousJstDay,
} from "./activeSession";

describe("calculateActiveSessionStayMinutes", () => {
  it("入退室日時から完了した滞在分数を計算する", () => {
    expect(
      calculateActiveSessionStayMinutes(
        new Date("2026-07-31T01:00:00.000Z"),
        new Date("2026-07-31T02:23:59.999Z"),
      ),
    ).toBe(83);
  });

  it.each([
    [
      new Date("2026-07-31T01:00:00.000Z"),
      new Date("2026-07-31T01:00:59.999Z"),
    ],
    [
      new Date("2026-07-31T02:00:00.000Z"),
      new Date("2026-07-31T01:00:00.000Z"),
    ],
    [new Date(Number.NaN), new Date("2026-07-31T01:00:00.000Z")],
  ])("1分未満、逆転、無効日時を拒否する", (enteredAt, exitedAt) => {
    expect(calculateActiveSessionStayMinutes(enteredAt, exitedAt)).toBeNull();
  });
});

describe("formatActiveSessionElapsed", () => {
  it.each([
    [0, "0分"],
    [23, "23分"],
    [60, "1時間"],
    [83, "1時間23分"],
    [1_501, "25時間1分"],
  ])("%i分を経過時間として表示する", (minutes, expected) => {
    const enteredAt = new Date("2026-07-31T00:00:00.000Z");
    const now = new Date(enteredAt.getTime() + minutes * 60_000);
    expect(formatActiveSessionElapsed(enteredAt, now)).toBe(expected);
  });

  it("無効日時や未来の入室日時でクラッシュしない", () => {
    expect(
      formatActiveSessionElapsed(
        new Date(Number.NaN),
        new Date("2026-07-31T00:00:00.000Z"),
      ),
    ).toBe("—");
    expect(
      formatActiveSessionElapsed(
        new Date("2026-07-31T01:00:00.000Z"),
        new Date("2026-07-31T00:00:00.000Z"),
      ),
    ).toBe("—");
  });
});

describe("isActiveSessionFromPreviousJstDay", () => {
  it("日本時間の日付をまたいだ入室を検出する", () => {
    expect(
      isActiveSessionFromPreviousJstDay(
        new Date("2026-07-31T14:59:00.000Z"),
        new Date("2026-07-31T15:01:00.000Z"),
      ),
    ).toBe(true);
  });

  it("同じ日本時間の日付と無効日時ではfalseを返す", () => {
    expect(
      isActiveSessionFromPreviousJstDay(
        new Date("2026-07-31T00:00:00.000Z"),
        new Date("2026-07-31T14:59:00.000Z"),
      ),
    ).toBe(false);
    expect(
      isActiveSessionFromPreviousJstDay(
        new Date(Number.NaN),
        new Date("2026-07-31T00:00:00.000Z"),
      ),
    ).toBe(false);
  });
});

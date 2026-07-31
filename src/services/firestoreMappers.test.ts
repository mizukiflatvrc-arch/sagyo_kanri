import { describe, expect, it } from "vitest";
import {
  InvalidFirestoreDataError,
  selfCriticismScoreFromData,
} from "./firestoreMappers";

describe("selfCriticismScoreFromData", () => {
  it("現在形式の0〜10スコアをそのまま使用する", () => {
    expect(
      selfCriticismScoreFromData({
        selfCriticismScore: 7,
        selfCriticismMinutes: 1,
        stayMinutes: 120,
      }),
    ).toBe(7);
  });

  it.each([
    [0, 120, 0],
    [15, 120, 1],
    [60, 120, 5],
    [120, 120, 10],
    [150, 120, 10],
  ])(
    "旧形式の%i分/%i分を%i点へ換算する",
    (selfCriticismMinutes, stayMinutes, expected) => {
      expect(
        selfCriticismScoreFromData({
          selfCriticismMinutes,
          stayMinutes,
        }),
      ).toBe(expected);
    },
  );

  it("新旧どちらの値もない不正データを拒否する", () => {
    expect(() =>
      selfCriticismScoreFromData({ stayMinutes: 120 }),
    ).toThrow(InvalidFirestoreDataError);
  });
});

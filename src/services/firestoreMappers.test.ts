import { describe, expect, it } from "vitest";
import type {
  DocumentData,
  QueryDocumentSnapshot,
} from "firebase/firestore";
import {
  InvalidFirestoreDataError,
  mapSessionDocument,
  selfCriticismScoreFromData,
} from "./firestoreMappers";

function sessionSnapshot(
  overrides: DocumentData = {},
): QueryDocumentSnapshot<DocumentData> {
  const data = {
    userId: "user-1",
    libraryId: "library-1",
    enteredAt: new Date("2026-07-23T00:00:00.000Z"),
    exitedAt: new Date("2026-07-23T02:00:00.000Z"),
    stayMinutes: 120,
    concentrationScore: 6,
    anxietyScore: 4,
    fatigueScore: 5,
    selfCriticismScore: 2,
    plannedTaskCreated: true,
    plannedTaskText: "資料を読む",
    actualTaskText: "資料を読んだ",
    completionStatus: "mostly_on_schedule",
    nextDayReaction: "pending",
    nextDayNote: "",
    note: "",
    createdAt: new Date("2026-07-23T03:00:00.000Z"),
    updatedAt: new Date("2026-07-23T03:00:00.000Z"),
    ...overrides,
  };
  return {
    id: "session-1",
    data: () => data,
  } as unknown as QueryDocumentSnapshot<DocumentData>;
}

describe("mapSessionDocument", () => {
  it("実作業時間がない現在形式を読み込める", () => {
    const session = mapSessionDocument(sessionSnapshot());

    expect(session).not.toHaveProperty("actualWorkMinutes");
    expect(session).not.toHaveProperty("selfCriticismMinutes");
  });

  it("旧形式の実作業時間と自己否定時間を保持する", () => {
    const session = mapSessionDocument(
      sessionSnapshot({
        actualWorkMinutes: 80,
        selfCriticismMinutes: 24,
      }),
    );

    expect(session.actualWorkMinutes).toBe(80);
    expect(session.selfCriticismMinutes).toBe(24);
  });

  it.each([null, "80", Number.NaN])(
    "実作業時間の不正値 %s を拒否する",
    (actualWorkMinutes) => {
      expect(() =>
        mapSessionDocument(sessionSnapshot({ actualWorkMinutes })),
      ).toThrow(InvalidFirestoreDataError);
    },
  );
});

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

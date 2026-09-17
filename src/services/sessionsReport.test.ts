import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collection: vi.fn(),
  getDocs: vi.fn(),
  orderBy: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
}));

vi.mock("firebase/firestore", async (importOriginal) => ({
  ...await importOriginal<typeof import("firebase/firestore")>(),
  ...mocks,
}));
vi.mock("../lib/firebase", () => ({ requireFirestore: () => ({}) }));

import { Timestamp } from "firebase/firestore";
import { getSessionsForReport } from "./sessions";

function stored(overrides: Record<string, unknown> = {}) {
  const enteredAt = new Date("2026-09-06T01:00:00.000Z");
  const exitedAt = new Date("2026-09-06T03:00:00.000Z");
  return {
    userId: "user-1",
    libraryId: "central",
    enteredAt: Timestamp.fromDate(enteredAt),
    exitedAt: Timestamp.fromDate(exitedAt),
    stayMinutes: 120,
    concentrationScore: 7,
    anxietyScore: 3,
    fatigueScore: 5,
    selfCriticismScore: 2,
    plannedTaskCreated: false,
    plannedTaskText: "",
    actualTaskText: "レポート実装",
    completionStatus: "not_planned",
    nextDayReaction: "pending",
    nextDayNote: "",
    note: "安定",
    deleting: false,
    createdAt: Timestamp.fromDate(exitedAt),
    updatedAt: Timestamp.fromDate(exitedAt),
    ...overrides,
  };
}

function document(data: ReturnType<typeof stored>) {
  return { id: "session-1", data: vi.fn(() => data) };
}

describe("getSessionsForReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.collection.mockReturnValue({ path: "sessions" });
    mocks.where.mockImplementation((...args) => args);
    mocks.orderBy.mockImplementation((...args) => args);
    mocks.query.mockReturnValue({ query: true });
  });

  it("比較開始から対象終了までを読み、集計に必要な文章と図書館を返す", async () => {
    mocks.getDocs.mockResolvedValue({ docs: [document(stored())] });
    const start = new Date("2026-08-24T15:00:00.000Z");
    const end = new Date("2026-09-07T15:00:00.000Z");

    const result = await getSessionsForReport("user-1", start, end);

    expect(mocks.where.mock.calls[0]?.[0]).toBe("enteredAt");
    expect(mocks.where.mock.calls[0]?.[1]).toBe(">=");
    expect(mocks.where.mock.calls[0]?.[2].toDate()).toEqual(start);
    expect(mocks.where.mock.calls[1]?.[1]).toBe("<");
    expect(mocks.where.mock.calls[1]?.[2].toDate()).toEqual(end);
    expect(result).toEqual([
      expect.objectContaining({
        libraryId: "central",
        stayMinutes: 120,
        selfCriticismScore: 2,
        actualTaskText: "レポート実装",
        note: "安定",
      }),
    ]);
  });

  it("削除処理中の記録をレポートへ含めない", async () => {
    mocks.getDocs.mockResolvedValue({
      docs: [document(stored({ deleting: true }))],
    });
    await expect(
      getSessionsForReport(
        "user-1",
        new Date("2026-08-24T15:00:00.000Z"),
        new Date("2026-09-07T15:00:00.000Z"),
      ),
    ).resolves.toEqual([]);
  });
});

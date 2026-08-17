import { beforeEach, describe, expect, it, vi } from "vitest";

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDoc: vi.fn(),
  onSnapshot: vi.fn(),
  runTransaction: vi.fn(),
  serverTimestamp: vi.fn(),
}));

const firestoreInstance = { name: "test-firestore" };

vi.mock("firebase/firestore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/firestore")>();
  return {
    ...actual,
    collection: firestoreMocks.collection,
    doc: firestoreMocks.doc,
    getDoc: firestoreMocks.getDoc,
    onSnapshot: firestoreMocks.onSnapshot,
    runTransaction: firestoreMocks.runTransaction,
    serverTimestamp: firestoreMocks.serverTimestamp,
  };
});

vi.mock("../lib/firebase", () => ({
  requireFirestore: () => firestoreInstance,
}));

import { Timestamp } from "firebase/firestore";
import {
  ActiveSessionAlreadyExistsError,
  ActiveSessionChangedError,
  ActiveSessionNotFoundError,
  InvalidActiveSessionDataError,
  cancelActiveSession,
  completeActiveSession,
  startActiveSession,
  startActiveSessionExit,
  subscribeActiveSession,
} from "./activeSessions";
import type { CompleteActiveSessionInput } from "../types/activeSession";

interface FakeReference {
  path: string;
  id: string;
}

function fakeSnapshot(data?: Record<string, unknown>) {
  return {
    exists: () => data !== undefined,
    data: () => data,
  };
}

function activeData(overrides: Record<string, unknown> = {}) {
  return {
    userId: "user-1",
    enteredAt: Timestamp.fromDate(new Date("2026-07-31T01:00:00.000Z")),
    createdAt: Timestamp.fromDate(new Date("2026-07-31T01:00:00.000Z")),
    updatedAt: Timestamp.fromDate(new Date("2026-07-31T01:00:00.000Z")),
    ...overrides,
  };
}

function completeInput(
  overrides: Partial<CompleteActiveSessionInput> = {},
): CompleteActiveSessionInput {
  return {
    activeEnteredAt: new Date("2026-07-31T01:00:00.000Z"),
    libraryId: "library-1",
    enteredAt: new Date("2026-07-31T01:00:00.000Z"),
    exitedAt: new Date("2026-07-31T03:00:00.000Z"),
    concentrationScore: 7,
    anxietyScore: 4,
    fatigueScore: 6,
    selfCriticismScore: 3,
    plannedTaskCreated: true,
    plannedTaskText: "資料を読む",
    actualTaskText: "資料を読んだ",
    completionStatus: "mostly_on_schedule",
    note: "",
    ...overrides,
  };
}

function transactionFor(data?: Record<string, unknown>) {
  return {
    get: vi.fn().mockResolvedValue(fakeSnapshot(data)),
    set: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  firestoreMocks.serverTimestamp.mockReturnValue({
    _methodName: "serverTimestamp",
  });
  firestoreMocks.collection.mockImplementation(
    (_firestore: unknown, ...segments: string[]): FakeReference => ({
      path: segments.join("/"),
      id: segments.at(-1) ?? "",
    }),
  );
  firestoreMocks.doc.mockImplementation(
    (parent: FakeReference, ...segments: string[]): FakeReference => {
      if (segments.length === 0) {
        return {
          path: `${parent.path}/completed-session`,
          id: "completed-session",
        };
      }
      return {
        path: segments.join("/"),
        id: segments.at(-1) ?? "",
      };
    },
  );
});

describe("subscribeActiveSession", () => {
  it("固定パスを購読し、存在しない場合はnullを通知する", () => {
    const unsubscribe = vi.fn();
    firestoreMocks.onSnapshot.mockImplementation(
      (
        _reference: FakeReference,
        onData: (snapshot: ReturnType<typeof fakeSnapshot>) => void,
      ) => {
        onData(fakeSnapshot());
        return unsubscribe;
      },
    );
    const onData = vi.fn();

    const result = subscribeActiveSession("user-1", onData, vi.fn());

    expect(firestoreMocks.onSnapshot.mock.calls[0]?.[0]).toMatchObject({
      path: "users/user-1/activeSession/current",
    });
    expect(onData).toHaveBeenCalledWith(null);
    expect(result).toBe(unsubscribe);
  });
});

describe("startActiveSession", () => {
  it("activeSessionがない場合だけサーバー時刻で作成する", async () => {
    const transaction = transactionFor();
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await startActiveSession("user-1");

    expect(transaction.set).toHaveBeenCalledOnce();
    expect(transaction.set.mock.calls[0]?.[0]).toMatchObject({
      path: "users/user-1/activeSession/current",
    });
    expect(transaction.set.mock.calls[0]?.[1]).toMatchObject({
      userId: "user-1",
      enteredAt: { _methodName: "serverTimestamp" },
      createdAt: { _methodName: "serverTimestamp" },
      updatedAt: { _methodName: "serverTimestamp" },
    });
  });

  it("既に存在する場合は二重作成しない", async () => {
    const transaction = transactionFor(activeData());
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await expect(startActiveSession("user-1")).rejects.toBeInstanceOf(
      ActiveSessionAlreadyExistsError,
    );
    expect(transaction.set).not.toHaveBeenCalled();
  });
});

describe("startActiveSessionExit", () => {
  it("退出時刻を一度だけ設定し、コミット後の値を返す", async () => {
    const transaction = transactionFor(activeData());
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );
    const exitStartedAt = new Date("2026-07-31T03:00:00.000Z");
    firestoreMocks.getDoc.mockResolvedValue(
      fakeSnapshot(
        activeData({
          exitStartedAt: Timestamp.fromDate(exitStartedAt),
          updatedAt: Timestamp.fromDate(exitStartedAt),
        }),
      ),
    );

    await expect(startActiveSessionExit("user-1")).resolves.toEqual(
      exitStartedAt,
    );
    expect(transaction.update).toHaveBeenCalledOnce();
    expect(transaction.update.mock.calls[0]?.[1]).toMatchObject({
      exitStartedAt: { _methodName: "serverTimestamp" },
      updatedAt: { _methodName: "serverTimestamp" },
    });
  });

  it("既存の退出時刻を上書きしない", async () => {
    const exitStartedAt = new Date("2026-07-31T03:00:00.000Z");
    const transaction = transactionFor(
      activeData({ exitStartedAt: Timestamp.fromDate(exitStartedAt) }),
    );
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await expect(startActiveSessionExit("user-1")).resolves.toEqual(
      exitStartedAt,
    );
    expect(transaction.update).not.toHaveBeenCalled();
    expect(firestoreMocks.getDoc).not.toHaveBeenCalled();
  });
});

describe("cancelActiveSession", () => {
  it("表示していた入室日時と一致する記録だけを削除する", async () => {
    const transaction = transactionFor(activeData());
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await expect(
      cancelActiveSession(
        "user-1",
        new Date("2026-07-31T01:00:00.000Z"),
      ),
    ).resolves.toBe(true);
    expect(transaction.delete).toHaveBeenCalledOnce();
  });

  it("固定パスが新しい入室へ変わっていた場合は削除しない", async () => {
    const transaction = transactionFor(activeData());
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await expect(
      cancelActiveSession(
        "user-1",
        new Date("2026-07-31T00:00:00.000Z"),
      ),
    ).rejects.toBeInstanceOf(ActiveSessionChangedError);
    expect(transaction.delete).not.toHaveBeenCalled();
  });
});

describe("completeActiveSession", () => {
  it("完成セッション作成とactiveSession削除を同じtransactionで行う", async () => {
    const transaction = transactionFor(
      activeData({
        exitStartedAt: Timestamp.fromDate(
          new Date("2026-07-31T03:00:00.000Z"),
        ),
      }),
    );
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await expect(
      completeActiveSession("user-1", completeInput()),
    ).resolves.toBe("completed-session");

    expect(transaction.set).toHaveBeenCalledOnce();
    const payload = transaction.set.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      userId: "user-1",
      libraryId: "library-1",
      stayMinutes: 120,
      selfCriticismScore: 3,
      nextDayReaction: "pending",
      nextDayNote: "",
      version: 1,
      deleting: false,
    });
    expect(payload).not.toHaveProperty("actualWorkMinutes");
    expect(payload).not.toHaveProperty("selfCriticismMinutes");
    expect(transaction.delete).toHaveBeenCalledOnce();
    expect(transaction.delete.mock.calls[0]?.[0]).toMatchObject({
      path: "users/user-1/activeSession/current",
    });
  });

  it("activeSessionが消えた後の二重保存では新しいsessionを書かない", async () => {
    let activeExists = true;
    const setCalls: unknown[] = [];
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => {
        const transaction = {
          get: vi
            .fn()
            .mockResolvedValue(
              fakeSnapshot(
                activeExists
                  ? activeData({
                      exitStartedAt: Timestamp.fromDate(
                        new Date("2026-07-31T03:00:00.000Z"),
                      ),
                    })
                  : undefined,
              ),
            ),
          set: vi.fn((...args: unknown[]) => setCalls.push(args)),
          update: vi.fn(),
          delete: vi.fn(() => {
            activeExists = false;
          }),
        };
        return callback(transaction);
      },
    );

    await completeActiveSession("user-1", completeInput());
    await expect(
      completeActiveSession("user-1", completeInput()),
    ).rejects.toBeInstanceOf(ActiveSessionNotFoundError);
    expect(setCalls).toHaveLength(1);
  });

  it("自己否定の割合が0〜10の整数でない場合は保存しない", async () => {
    await expect(
      completeActiveSession(
        "user-1",
        completeInput({ selfCriticismScore: 11 }),
      ),
    ).rejects.toBeInstanceOf(InvalidActiveSessionDataError);
    expect(firestoreMocks.runTransaction).not.toHaveBeenCalled();
  });

  it("古い日報画面から新しいactiveSessionを確定しない", async () => {
    const transaction = transactionFor(
      activeData({
        enteredAt: Timestamp.fromDate(
          new Date("2026-08-01T01:00:00.000Z"),
        ),
        exitStartedAt: Timestamp.fromDate(
          new Date("2026-08-01T03:00:00.000Z"),
        ),
      }),
    );
    firestoreMocks.runTransaction.mockImplementation(
      async (_firestore, callback) => callback(transaction),
    );

    await expect(
      completeActiveSession("user-1", completeInput()),
    ).rejects.toBeInstanceOf(ActiveSessionChangedError);
    expect(transaction.set).not.toHaveBeenCalled();
    expect(transaction.delete).not.toHaveBeenCalled();
  });
});

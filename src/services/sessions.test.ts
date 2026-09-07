import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn(), collection: vi.fn(), doc: vi.fn(),
  runTransaction: vi.fn(), serverTimestamp: vi.fn(),
}));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...await importOriginal<typeof import("firebase/firestore")>(),
  ...mocks,
}));
vi.mock("../lib/firebase", () => ({ requireFirestore: () => ({}) }));

import { Timestamp } from "firebase/firestore";
import { createSession, updateNextDayReaction, updateSession } from "./sessions";
import { completeActiveSession } from "./activeSessions";
import { mapSessionDocument } from "./firestoreMappers";
import { ConcurrentEditError } from "./errors";
import type { EditableLibrarySessionFields } from "../types";

function input(): EditableLibrarySessionFields {
  return {
    libraryId: "library-1",
    enteredAt: new Date("2026-07-31T01:00:00Z"),
    exitedAt: new Date("2026-07-31T03:00:00Z"),
    stayMinutes: 120,
    concentrationScore: 5, anxietyScore: 5, fatigueScore: 5, selfCriticismScore: 0,
    plannedTaskCreated: true, plannedTaskText: "", completionStatus: "on_schedule",
    actualTaskText: "", nextDayReaction: "pending", nextDayNote: "", note: "",
  };
}

function stored(overrides: Record<string, unknown> = {}) {
  const fields = input();
  return {
    ...fields, userId: "user-1", version: 1, deleting: false,
    enteredAt: Timestamp.fromDate(fields.enteredAt),
    exitedAt: Timestamp.fromDate(fields.exitedAt),
    createdAt: Timestamp.fromDate(fields.exitedAt),
    updatedAt: Timestamp.fromDate(fields.exitedAt),
    ...overrides,
  };
}

function snapshot(data: ReturnType<typeof stored>) {
  return { id: "session-1", exists: () => true, data: () => data };
}

function transaction(data = stored()) {
  const result = {
    get: vi.fn().mockResolvedValue(snapshot(data)),
    set: vi.fn(), update: vi.fn(), delete: vi.fn(),
  };
  mocks.runTransaction.mockImplementation(async (_db, callback) => callback(result));
  return result;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.collection.mockReturnValue({ path: "sessions" });
  mocks.doc.mockReturnValue({ id: "session-1" });
  mocks.addDoc.mockResolvedValue({ id: "session-1" });
  mocks.serverTimestamp.mockReturnValue("server-timestamp");
});

describe.each(["manual", "timecard"] as const)("%s creation", (route) => {
  function save(fields: EditableLibrarySessionFields) {
    return route === "manual"
      ? createSession("user-1", fields)
      : completeActiveSession("user-1", { ...fields, activeEnteredAt: fields.enteredAt });
  }

  it.each(["", "   ", "\t\n　"])("normalizes blank plan %j despite a stale flag/status", async (plannedTaskText) => {
    const tx = transaction(stored({ exitStartedAt: Timestamp.fromDate(input().exitedAt) }));
    await save({ ...input(), plannedTaskText });
    const payload = route === "manual" ? mocks.addDoc.mock.calls[0]?.[1] : tx.set.mock.calls[0]?.[1];
    expect(payload).toMatchObject({
      plannedTaskCreated: false, plannedTaskText: "", completionStatus: "not_planned",
    });
  });

  it.each(["on_schedule", "mostly_on_schedule", "off_schedule"] as const)("saves a plan with %s and derives its flag", async (completionStatus) => {
    const tx = transaction(stored({ exitStartedAt: Timestamp.fromDate(input().exitedAt) }));
    await save({ ...input(), plannedTaskCreated: false, plannedTaskText: " 仕様書を書く ", completionStatus });
    const payload = route === "manual" ? mocks.addDoc.mock.calls[0]?.[1] : tx.set.mock.calls[0]?.[1];
    expect(payload).toMatchObject({ plannedTaskCreated: true, plannedTaskText: "仕様書を書く", completionStatus });
  });

  it("rejects a plan with not_planned before any writes or active-session deletion", async () => {
    const tx = transaction();
    await expect(save({ ...input(), plannedTaskText: "仕様書を書く", completionStatus: "not_planned" }))
      .rejects.toThrow("終了状況");
    expect(mocks.addDoc).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
    expect(tx.delete).not.toHaveBeenCalled();
  });
});

describe("existing plan compatibility and revisions", () => {
  const plans = [
    { plannedTaskCreated: true, plannedTaskText: "", completionStatus: "on_schedule" },
    { plannedTaskCreated: false, plannedTaskText: "", completionStatus: "on_schedule" },
    { plannedTaskCreated: true, plannedTaskText: " 過去の予定 ", completionStatus: "not_planned" },
  ] as const;

  it.each(plans)("keeps $plannedTaskCreated / $plannedTaskText / $completionStatus during unrelated edits", async (plan) => {
    const before = stored(plan);
    const tx = transaction(before);
    await updateSession("user-1", "session-1", {
      ...input(), plannedTaskCreated: false, plannedTaskText: "古いフォームの値",
      completionStatus: "off_schedule", actualTaskText: "実装した", concentrationScore: 7, note: "メモ",
    });
    expect(tx.update.mock.calls[0]?.[1]).toMatchObject(plan);
    expect(tx.set.mock.calls[0]?.[1]).toMatchObject({
      snapshot: before, changedFields: ["concentrationScore", "actualTaskText", "note"],
    });
  });

  it.each(plans)("keeps the plan during next-day edits: $plannedTaskCreated / $completionStatus", async (plan) => {
    const before = stored(plan);
    const tx = transaction(before);
    await updateNextDayReaction("user-1", "session-1", "mild", " 翌日メモ ");
    expect(tx.update.mock.calls[0]?.[1]).toMatchObject(plan);
    expect(tx.set.mock.calls[0]?.[1]).toMatchObject({
      snapshot: before, changedFields: ["nextDayReaction", "nextDayNote"],
    });
  });

  it("creates no revision for hidden plan differences alone", async () => {
    const tx = transaction();
    await updateSession("user-1", "session-1", { ...input(), plannedTaskCreated: false, completionStatus: "not_planned" });
    expect(tx.update).not.toHaveBeenCalled();
    expect(tx.set).not.toHaveBeenCalled();
  });

  it("uses the latest plan on transaction retry and preserves next-day fields", async () => {
    const tx = transaction();
    const latestPlan = { plannedTaskCreated: true, plannedTaskText: "別画面の予定", completionStatus: "off_schedule" };
    const latest = stored({ ...latestPlan, version: 2, nextDayReaction: "strong", nextDayNote: "最新の翌日メモ" });
    mocks.runTransaction.mockImplementation(async (_db, callback) => {
      await callback(tx);
      tx.get.mockResolvedValue(snapshot(latest));
      tx.update.mockClear();
      tx.set.mockClear();
      return callback(tx);
    });
    await updateSession("user-1", "session-1", { ...input(), note: "編集" });
    expect(tx.update.mock.calls[0]?.[1]).toMatchObject({ ...latestPlan, nextDayReaction: "strong", nextDayNote: "最新の翌日メモ", version: 3 });
    expect(tx.set.mock.calls[0]?.[1]).toMatchObject({ snapshot: latest, changedFields: ["note"] });
  });

  it("applies only explicit plan fields to the transaction's current plan", async () => {
    const tx = transaction(stored({ plannedTaskText: "現在の予定", completionStatus: "mostly_on_schedule" }));
    await updateSession("user-1", "session-1", input(), undefined, { plannedTaskText: " 新しい予定 " });
    expect(tx.update.mock.calls[0]?.[1]).toMatchObject({ plannedTaskCreated: true, plannedTaskText: "新しい予定", completionStatus: "mostly_on_schedule" });
    expect(tx.set.mock.calls[0]?.[1].changedFields).toEqual(["plannedTaskText"]);
  });

  it("normalizes explicitly cleared plan fields and records exact changes", async () => {
    const tx = transaction(stored({ plannedTaskText: "現在の予定" }));
    await updateSession("user-1", "session-1", input(), undefined, { plannedTaskText: " " });
    expect(tx.update.mock.calls[0]?.[1]).toMatchObject({ plannedTaskCreated: false, plannedTaskText: "", completionStatus: "not_planned" });
    expect(tx.set.mock.calls[0]?.[1].changedFields).toEqual(["plannedTaskCreated", "plannedTaskText", "completionStatus"]);
  });

  it("rejects conflicting versions before making a revision", async () => {
    const tx = transaction();
    await expect(updateSession("user-1", "session-1", input(), new Date(0))).rejects.toBeInstanceOf(ConcurrentEditError);
    expect(tx.set).not.toHaveBeenCalled();
  });

  it.each(plans)("maps historical plans without normalizing: $plannedTaskCreated / $completionStatus", (plan) => {
    const doc = snapshot(stored(plan));
    expect(mapSessionDocument(doc as unknown as Parameters<typeof mapSessionDocument>[0])).toMatchObject(plan);
  });
});

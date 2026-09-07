import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  addDoc: vi.fn(),
  runTransaction: vi.fn(),
}));

vi.mock("../lib/firebase", () => ({ requireFirestore: () => ({}) }));
vi.mock("firebase/firestore", async (importOriginal) => ({
  ...await importOriginal<typeof import("firebase/firestore")>(),
  collection: (_parent: unknown, ...parts: string[]) => parts.join("/"),
  doc: (_parent: unknown, ...parts: string[]) => parts.join("/"),
  addDoc: mocks.addDoc,
  runTransaction: mocks.runTransaction,
}));

import { createSession, updateNextDayReaction, updateSession } from "./sessions";
import { mapSessionDocument } from "./firestoreMappers";
import { createEmptySessionFormValues, sessionToFormValues } from "../utils/format";
import { parseSessionForm } from "../utils/validation";
import type { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";
import type { CompletionStatus } from "../types";

function newInput() {
  return parseSessionForm({
    ...createEmptySessionFormValues(),
    libraryId: "library-1",
    enteredAt: "2026-08-01T10:00",
    exitedAt: "2026-08-01T12:00",
  })!;
}

function storedSession(completionStatus: CompletionStatus) {
  return {
    ...newInput(),
    userId: "user-1",
    plannedTaskCreated: completionStatus !== "not_planned",
    plannedTaskText: completionStatus === "not_planned" ? "" : "  資料を読む\n",
    completionStatus,
    actualWorkMinutes: 80,
    version: 1,
    deleting: false,
    createdAt: new Date("2026-08-01T03:00:00Z"),
    updatedAt: new Date("2026-08-01T03:00:00Z"),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("日報の保存と予定フィールドの互換性", () => {
  it("通常追加でも予定なし・作業内容未入力の互換値を保存する", async () => {
    mocks.addDoc.mockResolvedValue({ id: "session-1" });
    await expect(createSession("user-1", newInput())).resolves.toBe("session-1");
    expect(mocks.addDoc.mock.calls[0]?.[1]).toMatchObject({
      plannedTaskCreated: false,
      plannedTaskText: "",
      actualTaskText: "",
      completionStatus: "not_planned",
    });
  });

  it.each(["not_planned", "on_schedule", "mostly_on_schedule", "off_schedule"] as const)(
    "%s の編集と翌日追記で予定・比較結果を保持し、更新前の履歴を残す",
    async (completionStatus) => {
      const raw = storedSession(completionStatus);
      const snapshot = {
        id: "session-1", exists: () => true, data: () => raw,
      } as unknown as QueryDocumentSnapshot<DocumentData>;
      const transaction = {
        get: vi.fn().mockResolvedValue(snapshot),
        set: vi.fn(),
        update: vi.fn(),
      };
      mocks.runTransaction.mockImplementation(async (_db, callback) => callback(transaction));
      const fields = {
        plannedTaskCreated: raw.plannedTaskCreated,
        plannedTaskText: raw.plannedTaskText,
        completionStatus,
      };
      const values = sessionToFormValues(mapSessionDocument(snapshot));
      const parsed = parseSessionForm({ ...values, actualTaskText: "  コードを書いた  " })!;
      // Even stale/default hidden form values must not overwrite historical data.
      await updateSession("user-1", "session-1", {
        ...parsed,
        plannedTaskCreated: false,
        plannedTaskText: "",
        completionStatus: "not_planned",
      });
      const payload = transaction.update.mock.calls[0]?.[1];
      expect(payload).toMatchObject({ ...fields, actualTaskText: "コードを書いた", version: 2 });
      expect(payload).not.toHaveProperty("actualWorkMinutes");
      expect(transaction.set.mock.calls[0]?.[1]).toMatchObject({
        snapshot: raw,
        changedFields: ["actualTaskText"],
      });

      transaction.set.mockClear();
      transaction.update.mockClear();
      await updateNextDayReaction("user-1", "session-1", "mild", "翌日のメモ");
      expect(transaction.update.mock.calls[0]?.[1]).toMatchObject({
        ...fields,
        nextDayReaction: "mild",
        nextDayNote: "翌日のメモ",
      });
      expect(transaction.set.mock.calls[0]?.[1]).toMatchObject({
        snapshot: raw,
        changedFields: ["nextDayReaction", "nextDayNote"],
      });
    },
  );
});

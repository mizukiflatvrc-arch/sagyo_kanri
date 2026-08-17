import {
  Timestamp,
  collection,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  type DocumentData,
  type DocumentSnapshot,
  type Firestore,
  type Unsubscribe,
} from "firebase/firestore";
import { requireFirestore } from "../lib/firebase";
import type {
  ActiveSession,
  CompleteActiveSessionInput,
} from "../types/activeSession";
import { calculateActiveSessionStayMinutes } from "../utils/activeSession";

const COMPLETION_STATUSES = new Set([
  "on_schedule",
  "mostly_on_schedule",
  "off_schedule",
]);

export class ActiveSessionAlreadyExistsError extends Error {
  constructor() {
    super("すでに入室中です。");
    this.name = "ActiveSessionAlreadyExistsError";
  }
}

export class ActiveSessionNotFoundError extends Error {
  constructor() {
    super("入室中の記録が見つかりません。");
    this.name = "ActiveSessionNotFoundError";
  }
}

export class ActiveSessionNotReadyError extends Error {
  constructor() {
    super("先に退出時刻を確定してください。");
    this.name = "ActiveSessionNotReadyError";
  }
}

export class ActiveSessionChangedError extends Error {
  constructor() {
    super("入室中の記録が別の画面で変更されました。");
    this.name = "ActiveSessionChangedError";
  }
}

export class InvalidActiveSessionDataError extends Error {
  constructor(message = "入室中の記録を読み込めませんでした。") {
    super(message);
    this.name = "InvalidActiveSessionDataError";
  }
}

function requireUserId(userId: string): void {
  if (userId.trim() === "") {
    throw new InvalidActiveSessionDataError(
      "ログイン状態を確認できませんでした。",
    );
  }
}

function dateFrom(value: unknown): Date {
  const date =
    value instanceof Timestamp
      ? value.toDate()
      : value instanceof Date
        ? value
        : null;
  if (!date || !Number.isFinite(date.getTime())) {
    throw new InvalidActiveSessionDataError();
  }
  return date;
}

function activeSessionReference(firestore: Firestore, userId: string) {
  return doc(firestore, "users", userId, "activeSession", "current");
}

export function mapActiveSessionDocument(
  snapshot: DocumentSnapshot<DocumentData>,
): ActiveSession {
  if (!snapshot.exists()) {
    throw new ActiveSessionNotFoundError();
  }

  const data = snapshot.data({ serverTimestamps: "estimate" });
  if (typeof data.userId !== "string" || data.userId === "") {
    throw new InvalidActiveSessionDataError();
  }

  const activeSession: ActiveSession = {
    userId: data.userId,
    enteredAt: dateFrom(data.enteredAt),
    createdAt: dateFrom(data.createdAt),
    updatedAt: dateFrom(data.updatedAt),
  };
  if (data.exitStartedAt !== undefined) {
    activeSession.exitStartedAt = dateFrom(data.exitStartedAt);
  }
  return activeSession;
}

export function subscribeActiveSession(
  userId: string,
  onData: (activeSession: ActiveSession | null) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  requireUserId(userId);
  const reference = activeSessionReference(requireFirestore(), userId);
  return onSnapshot(
    reference,
    (snapshot) => {
      if (!snapshot.exists()) {
        onData(null);
        return;
      }
      try {
        const activeSession = mapActiveSessionDocument(snapshot);
        if (activeSession.userId !== userId) {
          throw new InvalidActiveSessionDataError();
        }
        onData(activeSession);
      } catch (error) {
        onError(
          error instanceof Error
            ? error
            : new InvalidActiveSessionDataError(),
        );
      }
    },
    onError,
  );
}

/**
 * Creates the one fixed active-session document only when it does not exist.
 * The transaction makes concurrent entry attempts converge on one document.
 */
export async function startActiveSession(userId: string): Promise<void> {
  requireUserId(userId);
  const firestore = requireFirestore();
  const reference = activeSessionReference(firestore, userId);

  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (snapshot.exists()) {
      throw new ActiveSessionAlreadyExistsError();
    }

    transaction.set(reference, {
      userId,
      enteredAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

/**
 * Fixes exitStartedAt once. Existing values are returned without an update.
 * A newly written server timestamp is read back after the transaction commits.
 */
export async function startActiveSessionExit(
  userId: string,
): Promise<Date> {
  requireUserId(userId);
  const firestore = requireFirestore();
  const reference = activeSessionReference(firestore, userId);

  const result = await runTransaction(
    firestore,
    async (transaction): Promise<{ exitStartedAt?: Date }> => {
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists()) {
        throw new ActiveSessionNotFoundError();
      }
      const activeSession = mapActiveSessionDocument(snapshot);
      if (activeSession.userId !== userId) {
        throw new InvalidActiveSessionDataError();
      }
      if (activeSession.exitStartedAt) {
        return { exitStartedAt: activeSession.exitStartedAt };
      }

      transaction.update(reference, {
        exitStartedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      return {};
    },
  );

  if (result.exitStartedAt) return result.exitStartedAt;

  const committedSnapshot = await getDoc(reference);
  if (!committedSnapshot.exists()) {
    throw new ActiveSessionNotFoundError();
  }
  const committed = mapActiveSessionDocument(committedSnapshot);
  if (committed.userId !== userId) {
    throw new InvalidActiveSessionDataError();
  }
  if (!committed.exitStartedAt) {
    throw new ActiveSessionNotReadyError();
  }
  return committed.exitStartedAt;
}

/**
 * Deletes the active visit. When expectedEnteredAt is supplied, a newer visit
 * at the same fixed path is never accidentally removed by a stale dialog.
 */
export async function cancelActiveSession(
  userId: string,
  expectedEnteredAt?: Date,
): Promise<boolean> {
  requireUserId(userId);
  if (
    expectedEnteredAt !== undefined &&
    (
      !(expectedEnteredAt instanceof Date) ||
      !Number.isFinite(expectedEnteredAt.getTime())
    )
  ) {
    throw new InvalidActiveSessionDataError();
  }

  const firestore = requireFirestore();
  const reference = activeSessionReference(firestore, userId);
  return runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) return false;

    const activeSession = mapActiveSessionDocument(snapshot);
    if (activeSession.userId !== userId) {
      throw new InvalidActiveSessionDataError();
    }
    if (
      expectedEnteredAt &&
      activeSession.enteredAt.getTime() !== expectedEnteredAt.getTime()
    ) {
      throw new ActiveSessionChangedError();
    }

    transaction.delete(reference);
    return true;
  });
}

function validatedCompletedSession(input: CompleteActiveSessionInput) {
  if (
    !(input.activeEnteredAt instanceof Date) ||
    !Number.isFinite(input.activeEnteredAt.getTime())
  ) {
    throw new InvalidActiveSessionDataError();
  }
  const libraryId = input.libraryId.trim();
  const stayMinutes = calculateActiveSessionStayMinutes(
    input.enteredAt,
    input.exitedAt,
  );
  if (libraryId === "") {
    throw new InvalidActiveSessionDataError("図書館を選択してください。");
  }
  if (stayMinutes === null) {
    throw new InvalidActiveSessionDataError(
      "退室日時は入室日時より1分以上後にしてください。",
    );
  }

  const scores = [
    input.concentrationScore,
    input.anxietyScore,
    input.fatigueScore,
    input.selfCriticismScore,
  ];
  if (
    scores.some(
      (score) => !Number.isInteger(score) || score < 0 || score > 10,
    )
  ) {
    throw new InvalidActiveSessionDataError(
      "状態のスコアは0〜10の整数で入力してください。",
    );
  }

  if (!COMPLETION_STATUSES.has(input.completionStatus)) {
    throw new InvalidActiveSessionDataError("終了状況を選択してください。");
  }

  return {
    activeEnteredAt: input.activeEnteredAt,
    userInput: {
      libraryId,
      enteredAt: Timestamp.fromDate(input.enteredAt),
      exitedAt: Timestamp.fromDate(input.exitedAt),
      stayMinutes,
      concentrationScore: input.concentrationScore,
      anxietyScore: input.anxietyScore,
      fatigueScore: input.fatigueScore,
      selfCriticismScore: input.selfCriticismScore,
      plannedTaskCreated: input.plannedTaskCreated,
      plannedTaskText: input.plannedTaskText.trim(),
      actualTaskText: input.actualTaskText.trim(),
      completionStatus: input.completionStatus,
      note: input.note.trim(),
    },
  };
}

/**
 * Atomically creates one completed session and consumes activeSession/current.
 *
 * Concurrent saves read the same active document. After one transaction
 * commits, the other retries, observes the missing document, and fails before
 * it can create a duplicate session.
 */
export async function completeActiveSession(
  userId: string,
  input: CompleteActiveSessionInput,
): Promise<string> {
  requireUserId(userId);
  const { activeEnteredAt, userInput } = validatedCompletedSession(input);
  const firestore = requireFirestore();
  const activeReference = activeSessionReference(firestore, userId);
  // Generate the ID once, outside the retryable transaction callback.
  const sessionReference = doc(
    collection(firestore, "users", userId, "sessions"),
  );

  await runTransaction(firestore, async (transaction) => {
    const activeSnapshot = await transaction.get(activeReference);
    if (!activeSnapshot.exists()) {
      throw new ActiveSessionNotFoundError();
    }

    const activeSession = mapActiveSessionDocument(activeSnapshot);
    if (activeSession.userId !== userId) {
      throw new InvalidActiveSessionDataError();
    }
    if (activeSession.enteredAt.getTime() !== activeEnteredAt.getTime()) {
      throw new ActiveSessionChangedError();
    }
    if (!activeSession.exitStartedAt) {
      throw new ActiveSessionNotReadyError();
    }

    transaction.set(sessionReference, {
      ...userInput,
      userId,
      nextDayReaction: "pending",
      nextDayNote: "",
      version: 1,
      deleting: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    transaction.delete(activeReference);
  });

  return sessionReference.id;
}

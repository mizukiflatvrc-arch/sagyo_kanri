import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  writeBatch,
  type DocumentData,
  type Unsubscribe,
} from "firebase/firestore";
import type {
  EditableLibrarySessionFields,
  LibrarySession,
  NextDayReaction,
} from "../types";
import { requireFirestore } from "../lib/firebase";
import {
  mapSessionDocument,
} from "./firestoreMappers";
import { ConcurrentEditError } from "./errors";

const EDITABLE_KEYS = [
  "libraryId",
  "enteredAt",
  "exitedAt",
  "stayMinutes",
  "actualWorkMinutes",
  "concentrationScore",
  "anxietyScore",
  "fatigueScore",
  "selfCriticismMinutes",
  "plannedTaskCreated",
  "plannedTaskText",
  "actualTaskText",
  "completionStatus",
  "nextDayReaction",
  "nextDayNote",
  "note",
] as const satisfies ReadonlyArray<keyof EditableLibrarySessionFields>;

function sessionsCollection(userId: string) {
  return collection(requireFirestore(), "users", userId, "sessions");
}

function sessionPayload(input: EditableLibrarySessionFields) {
  return {
    ...input,
    enteredAt: Timestamp.fromDate(input.enteredAt),
    exitedAt: Timestamp.fromDate(input.exitedAt),
  };
}

function comparableValue(value: unknown): unknown {
  return value instanceof Date ? value.getTime() : value;
}

function changedFields(
  before: LibrarySession,
  after: EditableLibrarySessionFields,
): Array<keyof EditableLibrarySessionFields> {
  return EDITABLE_KEYS.filter(
    (key) => comparableValue(before[key]) !== comparableValue(after[key]),
  );
}

export function subscribeSessions(
  userId: string,
  onData: (sessions: LibrarySession[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const sessionsQuery = query(sessionsCollection(userId), orderBy("enteredAt", "desc"));
  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      try {
        onData(snapshot.docs.map(mapSessionDocument));
      } catch (mappingError) {
        onError(
          mappingError instanceof Error
            ? mappingError
            : new Error("保存データを読み込めませんでした。"),
        );
      }
    },
    onError,
  );
}

export async function createSession(
  userId: string,
  input: EditableLibrarySessionFields,
): Promise<string> {
  const reference = await addDoc(sessionsCollection(userId), {
    ...sessionPayload(input),
    userId,
    version: 1,
    deleting: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

async function updateWithRevision(
  userId: string,
  sessionId: string,
  buildNext: (current: LibrarySession) => EditableLibrarySessionFields,
  expectedUpdatedAt?: Date,
): Promise<void> {
  const firestore = requireFirestore();
  const sessionReference = doc(
    firestore,
    "users",
    userId,
    "sessions",
    sessionId,
  );
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(sessionReference);
    if (!snapshot.exists()) {
      throw new Error("記録が見つかりません。");
    }

    const raw = snapshot.data() as DocumentData;
    if (raw.deleting === true) {
      throw new Error("この記録は削除処理中です。");
    }

    const current = mapSessionDocument(snapshot);
    if (
      expectedUpdatedAt &&
      current.updatedAt.getTime() !== expectedUpdatedAt.getTime()
    ) {
      throw new ConcurrentEditError();
    }
    const next = buildNext(current);
    const fields = changedFields(current, next);
    if (fields.length === 0) return;

    const currentVersion =
      typeof raw.version === "number" && Number.isInteger(raw.version)
        ? raw.version
        : 1;
    const revisionReference = doc(
      collection(sessionReference, "revisions"),
      String(currentVersion),
    );

    transaction.set(revisionReference, {
      sessionId,
      version: currentVersion,
      // Store the exact Firestore document read by this transaction. Rules
      // compare this map with the pre-update resource, making the audit
      // snapshot both complete and tamper-resistant.
      snapshot: raw,
      changedAt: serverTimestamp(),
      changedFields: fields,
    });
    transaction.update(sessionReference, {
      ...sessionPayload(next),
      version: currentVersion + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateSession(
  userId: string,
  sessionId: string,
  input: EditableLibrarySessionFields,
  expectedUpdatedAt?: Date,
): Promise<void> {
  await updateWithRevision(
    userId,
    sessionId,
    (current) => ({
      ...input,
      // The next-day fields are edited on a separate screen. Preserve the
      // latest transaction value instead of overwriting it with hidden form
      // state from an older render.
      nextDayReaction: current.nextDayReaction,
      nextDayNote: current.nextDayNote,
    }),
    expectedUpdatedAt,
  );
}

export async function updateNextDayReaction(
  userId: string,
  sessionId: string,
  reaction: NextDayReaction,
  note: string,
  expectedUpdatedAt?: Date,
): Promise<void> {
  await updateWithRevision(
    userId,
    sessionId,
    (current) => ({
      libraryId: current.libraryId,
      enteredAt: current.enteredAt,
      exitedAt: current.exitedAt,
      stayMinutes: current.stayMinutes,
      actualWorkMinutes: current.actualWorkMinutes,
      concentrationScore: current.concentrationScore,
      anxietyScore: current.anxietyScore,
      fatigueScore: current.fatigueScore,
      selfCriticismMinutes: current.selfCriticismMinutes,
      plannedTaskCreated: current.plannedTaskCreated,
      plannedTaskText: current.plannedTaskText,
      actualTaskText: current.actualTaskText,
      completionStatus: current.completionStatus,
      nextDayReaction: reaction,
      nextDayNote: note.trim(),
      note: current.note,
    }),
    expectedUpdatedAt,
  );
}

export async function deleteSession(
  userId: string,
  sessionId: string,
): Promise<void> {
  const firestore = requireFirestore();
  const sessionReference = doc(
    firestore,
    "users",
    userId,
    "sessions",
    sessionId,
  );

  // First make the parent immutable. Security Rules reject further session
  // updates and revision creation once this marker is present, so a revision
  // cannot be added between the query below and the final parent deletion.
  const sessionExists = await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(sessionReference);
    if (!snapshot.exists()) return false;
    if (snapshot.data().deleting !== true) {
      transaction.update(sessionReference, {
        deleting: true,
        updatedAt: serverTimestamp(),
      });
    }
    return true;
  });
  if (!sessionExists) return;

  const revisions = await getDocs(collection(sessionReference, "revisions"));

  // Firestore batch is limited to 500 operations. Keep headroom and delete
  // revisions in bounded groups; the parent is removed after all snapshots.
  for (let index = 0; index < revisions.docs.length; index += 450) {
    const batch = writeBatch(firestore);
    revisions.docs.slice(index, index + 450).forEach((revision) => {
      batch.delete(revision.ref);
    });
    await batch.commit();
  }
  await deleteDoc(sessionReference);
}

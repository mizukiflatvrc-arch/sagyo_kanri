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
  type QueryDocumentSnapshot,
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
import {
  ENCRYPTION_VERSION,
  decryptText,
  encryptText,
  isEncryptedText,
  sensitiveFieldContext,
} from "./encryption";

const SENSITIVE_TEXT_KEYS = [
  "plannedTaskText",
  "actualTaskText",
  "nextDayNote",
  "note",
] as const satisfies ReadonlyArray<keyof EditableLibrarySessionFields>;

type SensitiveTextKey = (typeof SENSITIVE_TEXT_KEYS)[number];

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

async function encryptSensitiveFields(
  input: Pick<EditableLibrarySessionFields, SensitiveTextKey>,
  key: CryptoKey,
  userId: string,
  keys: readonly SensitiveTextKey[] = SENSITIVE_TEXT_KEYS,
): Promise<Partial<Record<SensitiveTextKey, string>>> {
  const entries = await Promise.all(
    keys.map(async (field) => [
      field,
      await encryptText(
        input[field],
        key,
        sensitiveFieldContext(userId, field),
      ),
    ] as const),
  );
  return Object.fromEntries(entries);
}

async function decryptSession(
  session: LibrarySession,
  key: CryptoKey,
  userId: string,
): Promise<LibrarySession> {
  const entries = await Promise.all(
    SENSITIVE_TEXT_KEYS.map(async (field) => [
      field,
      await decryptText(
        session[field],
        key,
        sensitiveFieldContext(userId, field),
      ),
    ] as const),
  );
  return { ...session, ...Object.fromEntries(entries) };
}

function needsEncryptionMigration(data: DocumentData): boolean {
  return (
    data.encryptionVersion !== ENCRYPTION_VERSION ||
    SENSITIVE_TEXT_KEYS.some((field) => !isEncryptedText(data[field]))
  );
}

async function encryptedLegacyFields(
  data: DocumentData,
  key: CryptoKey,
  userId: string,
): Promise<Partial<Record<SensitiveTextKey, string>>> {
  const legacyKeys = SENSITIVE_TEXT_KEYS.filter(
    (field) => !isEncryptedText(data[field]),
  );
  const input = Object.fromEntries(
    SENSITIVE_TEXT_KEYS.map((field) => {
      const value = data[field];
      if (typeof value !== "string") {
        throw new Error("保存データの形式を確認できませんでした。");
      }
      return [field, value];
    }),
  ) as Record<SensitiveTextKey, string>;
  return encryptSensitiveFields(input, key, userId, legacyKeys);
}

async function migrateSessionEncryption(
  userId: string,
  snapshot: QueryDocumentSnapshot<DocumentData>,
  key: CryptoKey,
): Promise<void> {
  const firestore = requireFirestore();
  const revisions = await getDocs(collection(snapshot.ref, "revisions"));

  // Existing revision snapshots may also contain plaintext. Each transaction
  // re-reads the immutable revision so migration stays safe when two tabs
  // unlock at the same time.
  for (const revision of revisions.docs) {
    await runTransaction(firestore, async (transaction) => {
      const fresh = await transaction.get(revision.ref);
      if (!fresh.exists()) return;
      const revisionData = fresh.data();
      const storedSnapshot = revisionData.snapshot;
      if (
        typeof storedSnapshot !== "object" ||
        storedSnapshot === null ||
        !needsEncryptionMigration(storedSnapshot)
      ) {
        return;
      }
      const encrypted = await encryptedLegacyFields(
        storedSnapshot,
        key,
        userId,
      );
      transaction.update(revision.ref, {
        snapshot: {
          ...storedSnapshot,
          ...encrypted,
          encryptionVersion: ENCRYPTION_VERSION,
        },
      });
    });
  }

  await runTransaction(firestore, async (transaction) => {
    const fresh = await transaction.get(snapshot.ref);
    if (!fresh.exists()) return;
    const data = fresh.data();
    if (!needsEncryptionMigration(data)) return;
    const encrypted = await encryptedLegacyFields(data, key, userId);
    transaction.update(snapshot.ref, {
      ...encrypted,
      encryptionVersion: ENCRYPTION_VERSION,
    });
  });
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
  key: CryptoKey,
  onData: (sessions: LibrarySession[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const sessionsQuery = query(sessionsCollection(userId), orderBy("enteredAt", "desc"));
  let generation = 0;
  return onSnapshot(
    sessionsQuery,
    (snapshot) => {
      const currentGeneration = ++generation;
      void (async () => {
        try {
          await Promise.all(
            snapshot.docs
              .filter((item) => needsEncryptionMigration(item.data()))
              .map((item) => migrateSessionEncryption(userId, item, key)),
          );
          const sessions = await Promise.all(
            snapshot.docs.map(async (item) =>
              decryptSession(mapSessionDocument(item), key, userId),
            ),
          );
          if (currentGeneration === generation) onData(sessions);
        } catch (mappingError) {
          if (currentGeneration !== generation) return;
          onError(
            mappingError instanceof Error
              ? mappingError
              : new Error("保存データを読み込めませんでした。"),
          );
        }
      })();
    },
    onError,
  );
}

export async function createSession(
  userId: string,
  input: EditableLibrarySessionFields,
  key: CryptoKey,
): Promise<string> {
  const encrypted = await encryptSensitiveFields(input, key, userId);
  const reference = await addDoc(sessionsCollection(userId), {
    ...sessionPayload(input),
    ...encrypted,
    userId,
    encryptionVersion: ENCRYPTION_VERSION,
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
  key: CryptoKey,
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

    const current = await decryptSession(
      mapSessionDocument(snapshot),
      key,
      userId,
    );
    if (
      expectedUpdatedAt &&
      current.updatedAt.getTime() !== expectedUpdatedAt.getTime()
    ) {
      throw new ConcurrentEditError();
    }
    const next = buildNext(current);
    const fields = changedFields(current, next);
    if (fields.length === 0) return;
    const sensitiveChanges = fields.filter(
      (field): field is SensitiveTextKey =>
        (SENSITIVE_TEXT_KEYS as readonly string[]).includes(field),
    );
    const encrypted = await encryptSensitiveFields(
      next,
      key,
      userId,
      sensitiveChanges,
    );
    const preservedSensitive = Object.fromEntries(
      SENSITIVE_TEXT_KEYS.filter(
        (field) => !sensitiveChanges.includes(field),
      ).map((field) => [field, raw[field]]),
    );

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
      ...preservedSensitive,
      ...encrypted,
      version: currentVersion + 1,
      updatedAt: serverTimestamp(),
    });
  });
}

export async function updateSession(
  userId: string,
  sessionId: string,
  input: EditableLibrarySessionFields,
  key: CryptoKey,
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
    key,
    expectedUpdatedAt,
  );
}

export async function updateNextDayReaction(
  userId: string,
  sessionId: string,
  reaction: NextDayReaction,
  note: string,
  key: CryptoKey,
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
    key,
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

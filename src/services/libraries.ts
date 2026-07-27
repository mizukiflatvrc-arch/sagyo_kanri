import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import type { EditableLibraryFields, Library } from "../types";
import { requireFirestore } from "../lib/firebase";
import { mapLibraryDocument } from "./firestoreMappers";
import { ConcurrentEditError } from "./errors";

export class LibraryInUseError extends Error {
  constructor() {
    super("この図書館は記録で使用されているため削除できません。");
    this.name = "LibraryInUseError";
  }
}

function librariesCollection(userId: string) {
  return collection(requireFirestore(), "users", userId, "libraries");
}

function libraryPayload(input: EditableLibraryFields) {
  const payload: Record<string, unknown> = {
    name: input.name.trim(),
    googleMapsUrl: input.googleMapsUrl.trim(),
  };
  if (input.latitude !== undefined) payload.latitude = input.latitude;
  if (input.longitude !== undefined) payload.longitude = input.longitude;
  return payload;
}

function libraryUpdatePayload(input: EditableLibraryFields) {
  return {
    name: input.name.trim(),
    googleMapsUrl: input.googleMapsUrl.trim(),
    latitude: input.latitude ?? deleteField(),
    longitude: input.longitude ?? deleteField(),
  };
}

export function subscribeLibraries(
  userId: string,
  onData: (libraries: Library[]) => void,
  onError: (error: Error) => void,
): Unsubscribe {
  const librariesQuery = query(librariesCollection(userId), orderBy("name", "asc"));
  return onSnapshot(
    librariesQuery,
    (snapshot) => {
      try {
        onData(snapshot.docs.map(mapLibraryDocument));
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

export async function createLibrary(
  userId: string,
  input: EditableLibraryFields,
): Promise<string> {
  const reference = await addDoc(librariesCollection(userId), {
    ...libraryPayload(input),
    userId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return reference.id;
}

export async function updateLibrary(
  userId: string,
  libraryId: string,
  input: EditableLibraryFields,
  expectedUpdatedAt?: Date,
): Promise<void> {
  const firestore = requireFirestore();
  const reference = doc(
    firestore,
    "users",
    userId,
    "libraries",
    libraryId,
  );
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists()) {
      throw new Error("図書館が見つかりません。");
    }
    const currentUpdatedAt = snapshot.data().updatedAt;
    if (
      expectedUpdatedAt &&
      (!(currentUpdatedAt instanceof Timestamp) ||
        currentUpdatedAt.toMillis() !== expectedUpdatedAt.getTime())
    ) {
      throw new ConcurrentEditError();
    }
    transaction.update(reference, {
      ...libraryUpdatePayload(input),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function deleteLibrary(
  userId: string,
  libraryId: string,
): Promise<void> {
  const firestore = requireFirestore();
  const usedBySession = await getDocs(
    query(
      collection(firestore, "users", userId, "sessions"),
      where("libraryId", "==", libraryId),
      limit(1),
    ),
  );
  if (!usedBySession.empty) {
    throw new LibraryInUseError();
  }

  const reference = doc(firestore, "users", userId, "libraries", libraryId);
  await runTransaction(firestore, async (transaction) => {
    const snapshot = await transaction.get(reference);
    if (!snapshot.exists() || snapshot.data().archivedAt !== undefined) return;

    // Keep the document internally so a session created in another tab at the
    // same instant can never be left with a dangling library reference.
    transaction.update(reference, {
      archivedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });
}

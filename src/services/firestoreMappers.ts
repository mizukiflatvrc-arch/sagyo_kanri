import {
  Timestamp,
  type DocumentData,
  type QueryDocumentSnapshot,
} from "firebase/firestore";
import type {
  CompletionStatus,
  Library,
  LibrarySession,
  NextDayReaction,
} from "../types";
import {
  COMPLETION_STATUSES,
  NEXT_DAY_REACTIONS,
} from "../types";

export class InvalidFirestoreDataError extends Error {
  constructor() {
    super("保存データの形式を確認できませんでした。");
    this.name = "InvalidFirestoreDataError";
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
    throw new InvalidFirestoreDataError();
  }
  return date;
}

function finiteNumber(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new InvalidFirestoreDataError();
  }
  return value;
}

function stringFrom(value: unknown): string {
  if (typeof value !== "string") {
    throw new InvalidFirestoreDataError();
  }
  return value;
}

function booleanFrom(value: unknown): boolean {
  if (typeof value !== "boolean") {
    throw new InvalidFirestoreDataError();
  }
  return value;
}

function completionStatusFrom(value: unknown): CompletionStatus {
  if (
    typeof value === "string" &&
    (COMPLETION_STATUSES as readonly string[]).includes(value)
  ) {
    return value as CompletionStatus;
  }
  throw new InvalidFirestoreDataError();
}

function nextDayReactionFrom(value: unknown): NextDayReaction {
  if (
    typeof value === "string" &&
    (NEXT_DAY_REACTIONS as readonly string[]).includes(value)
  ) {
    return value as NextDayReaction;
  }
  throw new InvalidFirestoreDataError();
}

export function mapLibraryDocument(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): Library {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  const library: Library = {
    id: snapshot.id,
    userId: stringFrom(data.userId),
    name: stringFrom(data.name),
    googleMapsUrl: stringFrom(data.googleMapsUrl),
    createdAt: dateFrom(data.createdAt),
    updatedAt: dateFrom(data.updatedAt),
  };

  if (data.latitude !== undefined) {
    library.latitude = finiteNumber(data.latitude);
  }
  if (data.longitude !== undefined) {
    library.longitude = finiteNumber(data.longitude);
  }
  if (data.archivedAt !== undefined) {
    library.archivedAt = dateFrom(data.archivedAt);
  }
  return library;
}

export function mapSessionDocument(
  snapshot: QueryDocumentSnapshot<DocumentData>,
): LibrarySession {
  const data = snapshot.data({ serverTimestamps: "estimate" });
  return {
    id: snapshot.id,
    userId: stringFrom(data.userId),
    libraryId: stringFrom(data.libraryId),
    enteredAt: dateFrom(data.enteredAt),
    exitedAt: dateFrom(data.exitedAt),
    stayMinutes: finiteNumber(data.stayMinutes),
    actualWorkMinutes: finiteNumber(data.actualWorkMinutes),
    concentrationScore: finiteNumber(data.concentrationScore),
    anxietyScore: finiteNumber(data.anxietyScore),
    fatigueScore: finiteNumber(data.fatigueScore),
    selfCriticismMinutes: finiteNumber(data.selfCriticismMinutes),
    plannedTaskCreated: booleanFrom(data.plannedTaskCreated),
    plannedTaskText: stringFrom(data.plannedTaskText),
    actualTaskText: stringFrom(data.actualTaskText),
    completionStatus: completionStatusFrom(data.completionStatus),
    nextDayReaction: nextDayReactionFrom(data.nextDayReaction),
    nextDayNote: stringFrom(data.nextDayNote),
    note: stringFrom(data.note),
    createdAt: dateFrom(data.createdAt),
    updatedAt: dateFrom(data.updatedAt),
  };
}

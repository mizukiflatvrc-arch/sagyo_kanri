export const COMPLETION_STATUSES = [
  "on_schedule",
  "mostly_on_schedule",
  "off_schedule",
] as const;

export type CompletionStatus = (typeof COMPLETION_STATUSES)[number];

export const NEXT_DAY_REACTIONS = [
  "pending",
  "none",
  "mild",
  "strong",
] as const;

export type NextDayReaction = (typeof NEXT_DAY_REACTIONS)[number];

/**
 * One visit to a library.
 *
 * Dates in the domain layer are always JavaScript Dates. Conversion to and
 * from Firestore Timestamp belongs at the repository boundary.
 */
export interface LibrarySession {
  id: string;
  userId: string;
  libraryId: string;

  enteredAt: Date;
  exitedAt: Date;
  stayMinutes: number;
  actualWorkMinutes: number;

  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismMinutes: number;

  plannedTaskCreated: boolean;
  plannedTaskText: string;
  actualTaskText: string;
  completionStatus: CompletionStatus;

  nextDayReaction: NextDayReaction;
  nextDayNote: string;
  note: string;

  createdAt: Date;
  updatedAt: Date;
}

export type CreateLibrarySessionInput = Omit<
  LibrarySession,
  "id" | "createdAt" | "updatedAt"
>;

export type EditableLibrarySessionFields = Omit<
  LibrarySession,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

export interface Library {
  id: string;
  userId: string;
  name: string;
  googleMapsUrl: string;
  latitude?: number;
  longitude?: number;
  /** Internally retained so historical sessions never lose their reference. */
  archivedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export type CreateLibraryInput = Omit<
  Library,
  "id" | "archivedAt" | "createdAt" | "updatedAt"
>;

export type EditableLibraryFields = Omit<
  Library,
  "id" | "userId" | "archivedAt" | "createdAt" | "updatedAt"
>;

export interface StoredSessionSnapshot extends Omit<LibrarySession, "id"> {
  version: number;
  deleting: boolean;
}

export interface SessionRevision {
  id: string;
  sessionId: string;
  version: number;
  snapshot: StoredSessionSnapshot;
  changedAt: Date;
  changedFields: Array<keyof EditableLibrarySessionFields>;
}

/**
 * Values held by the session form.
 *
 * datetime-local controls do not contain a time-zone designator. In this app
 * enteredAt/exitedAt are explicitly treated as wall-clock times in JST.
 * Numeric duration controls stay as strings so an empty/invalid input is not
 * accidentally coerced to zero before validation.
 */
export interface SessionFormValues {
  libraryId: string;
  enteredAt: string;
  exitedAt: string;

  actualWorkHours: string;
  actualWorkMinutes: string;
  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismHours: string;
  selfCriticismMinutes: string;

  plannedTaskCreated: boolean;
  plannedTaskText: string;
  actualTaskText: string;
  completionStatus: CompletionStatus;

  nextDayReaction: NextDayReaction;
  nextDayNote: string;
  note: string;
}

export interface LibraryFormValues {
  name: string;
  googleMapsUrl: string;
  latitude: string;
  longitude: string;
}

export interface NextDayReactionFormValues {
  nextDayReaction: NextDayReaction;
  nextDayNote: string;
}

export interface DurationParts {
  hours: number;
  minutes: number;
}

export type FormErrors<T extends object> = Partial<
  Record<Extract<keyof T, string>, string>
>;

export type SessionFormErrors = FormErrors<SessionFormValues>;
export type LibraryFormErrors = FormErrors<LibraryFormValues>;

export interface ParsedSessionFormValues {
  libraryId: string;
  enteredAt: Date;
  exitedAt: Date;
  stayMinutes: number;
  actualWorkMinutes: number;
  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismMinutes: number;
  plannedTaskCreated: boolean;
  plannedTaskText: string;
  actualTaskText: string;
  completionStatus: CompletionStatus;
  nextDayReaction: NextDayReaction;
  nextDayNote: string;
  note: string;
}

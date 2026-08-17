import type { CompletionStatus } from "./index";

/**
 * A single in-progress library visit.
 *
 * Dates are represented as JavaScript Dates in the application. The
 * active-session repository converts them to and from Firestore Timestamp.
 */
export interface ActiveSession {
  userId: string;
  enteredAt: Date;
  exitStartedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * User-editable daily-report values used to turn an ActiveSession into a
 * completed session.
 *
 * actualWorkMinutes is intentionally absent. All four state values use the
 * same 0..10 scale as manually created sessions.
 */
export interface CompleteActiveSessionInput {
  /** Immutable identity of the ActiveSession that opened this report form. */
  activeEnteredAt: Date;
  libraryId: string;
  enteredAt: Date;
  exitedAt: Date;

  concentrationScore: number;
  anxietyScore: number;
  fatigueScore: number;
  selfCriticismScore: number;

  plannedTaskCreated: boolean;
  plannedTaskText: string;
  actualTaskText: string;
  completionStatus: CompletionStatus;
  note: string;
}

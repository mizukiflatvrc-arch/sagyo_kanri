import { COMPLETION_STATUSES, type LibrarySession } from "../types";

export type SessionPlan = Pick<
  LibrarySession,
  "plannedTaskCreated" | "plannedTaskText" | "completionStatus"
>;

/** Only fields explicitly edited by the user; never hidden form state. */
export type SessionPlanChanges = Partial<
  Pick<SessionPlan, "plannedTaskText" | "completionStatus">
>;

export class InvalidSessionPlanError extends Error {
  constructor() {
    super("予定タスクに対する終了状況を選択してください。");
    this.name = "InvalidSessionPlanError";
  }
}

export function sessionPlanError(
  plan: Pick<SessionPlan, "plannedTaskText" | "completionStatus">,
): string | undefined {
  if (
    !COMPLETION_STATUSES.includes(plan.completionStatus) ||
    (plan.plannedTaskText.trim() !== "" && plan.completionStatus === "not_planned")
  ) {
    return new InvalidSessionPlanError().message;
  }
  return undefined;
}

/** For new sessions or explicit plan edits only. Never normalize reads. */
export function normalizeSessionPlan(
  plan: Pick<SessionPlan, "plannedTaskText" | "completionStatus">,
): SessionPlan {
  if (sessionPlanError(plan)) throw new InvalidSessionPlanError();
  const plannedTaskText = plan.plannedTaskText.trim();
  return {
    plannedTaskCreated: plannedTaskText !== "",
    plannedTaskText,
    completionStatus: plannedTaskText === "" ? "not_planned" : plan.completionStatus,
  };
}

export function sessionPlanChanges(
  initial: SessionPlan,
  values: SessionPlan,
): SessionPlanChanges {
  const changes: SessionPlanChanges = {};
  if (values.plannedTaskText !== initial.plannedTaskText) {
    changes.plannedTaskText = values.plannedTaskText;
  }
  if (values.completionStatus !== initial.completionStatus) {
    changes.completionStatus = values.completionStatus;
  }
  return changes;
}

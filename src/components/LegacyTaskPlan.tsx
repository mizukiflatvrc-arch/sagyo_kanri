import type { LibrarySession } from "../types";
import { COMPLETION_STATUS_LABELS } from "../utils/format";

type LegacyTaskPlanProps = {
  session: Pick<
    LibrarySession,
    "plannedTaskCreated" | "plannedTaskText" | "completionStatus"
  >;
};

/** Historical plan information remains readable without becoming a new input. */
export function LegacyTaskPlan({ session }: LegacyTaskPlanProps) {
  if (
    !session.plannedTaskCreated &&
    session.plannedTaskText === "" &&
    session.completionStatus === "not_planned"
  ) {
    return null;
  }

  return (
    <details className="detail-section">
      <summary>以前の予定・比較記録</summary>
      <dl className="detail-list">
        <div className="detail-item">
          <dt>予定タスクの作成</dt>
          <dd>{session.plannedTaskCreated ? "はい" : "いいえ"}</dd>
        </div>
        <div className="detail-item detail-item--wide">
          <dt>予定タスク</dt>
          <dd>{session.plannedTaskText || "—"}</dd>
        </div>
        <div className="detail-item">
          <dt>予定との比較</dt>
          <dd>{COMPLETION_STATUS_LABELS[session.completionStatus]}</dd>
        </div>
      </dl>
    </details>
  );
}

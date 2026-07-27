import type { ReactNode } from "react";
import { Clock3 } from "lucide-react";
import type { CompletionStatus, NextDayReaction } from "../types";
import {
  COMPLETION_STATUS_LABELS,
  NEXT_DAY_REACTION_LABELS,
} from "../utils/format";

export type StatusBadgeTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger";

interface StatusBadgeProps {
  children: ReactNode;
  tone?: StatusBadgeTone | undefined;
  icon?: ReactNode;
  className?: string | undefined;
}

interface CompletionStatusBadgeProps {
  status: CompletionStatus;
  className?: string | undefined;
}

interface NextDayReactionBadgeProps {
  reaction: NextDayReaction;
  className?: string | undefined;
}

const completionTones: Record<CompletionStatus, StatusBadgeTone> = {
  on_schedule: "success",
  mostly_on_schedule: "info",
  off_schedule: "warning",
};

const reactionTones: Record<NextDayReaction, StatusBadgeTone> = {
  pending: "neutral",
  none: "success",
  mild: "info",
  strong: "warning",
};

export function StatusBadge({
  children,
  tone = "neutral",
  icon,
  className,
}: StatusBadgeProps) {
  const classes = ["status-badge", `status-badge--${tone}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classes}>
      {icon ? (
        <span className="status-badge__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </span>
  );
}

export function CompletionStatusBadge({
  status,
  className,
}: CompletionStatusBadgeProps) {
  return (
    <StatusBadge
      tone={completionTones[status]}
      className={[
        `status-badge--completion-${status.replaceAll("_", "-")}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {COMPLETION_STATUS_LABELS[status]}
    </StatusBadge>
  );
}

export function NextDayReactionBadge({
  reaction,
  className,
}: NextDayReactionBadgeProps) {
  return (
    <StatusBadge
      tone={reactionTones[reaction]}
      icon={reaction === "pending" ? <Clock3 size={14} /> : undefined}
      className={[
        `status-badge--reaction-${reaction.replaceAll("_", "-")}`,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {NEXT_DAY_REACTION_LABELS[reaction]}
    </StatusBadge>
  );
}

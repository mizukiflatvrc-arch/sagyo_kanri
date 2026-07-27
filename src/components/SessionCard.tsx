import { useId, type ReactNode } from "react";
import { CalendarDays, Clock3, LibraryBig, Timer } from "lucide-react";
import { Link } from "react-router-dom";
import type { LibrarySession } from "../types";
import { formatJstDate } from "../utils/date";
import { formatMinutes } from "../utils/format";
import {
  CompletionStatusBadge,
  NextDayReactionBadge,
} from "./StatusBadge";

interface SessionCardProps {
  session: LibrarySession;
  libraryName?: string | undefined;
  /**
   * Defaults to /sessions/:id. Pass null when the card should not link to a
   * detail page (for example, inside an already-open detail view).
   */
  to?: string | null | undefined;
  actions?: ReactNode;
  className?: string | undefined;
}

const scoreItems = [
  { key: "concentrationScore", label: "集中度" },
  { key: "anxietyScore", label: "焦り" },
  { key: "fatigueScore", label: "疲労" },
] as const;

export function SessionCard({
  session,
  libraryName = "図書館名を確認できません",
  to,
  actions,
  className,
}: SessionCardProps) {
  const titleId = useId();
  const detailTo =
    to === undefined
      ? `/sessions/${encodeURIComponent(session.id)}`
      : to;
  const classes = ["session-card", className].filter(Boolean).join(" ");
  const dateLabel = formatJstDate(session.enteredAt);

  const libraryTitle = detailTo ? (
    <Link className="session-card__detail-link" to={detailTo}>
      {libraryName}
    </Link>
  ) : (
    libraryName
  );

  return (
    <article className={classes} aria-labelledby={titleId}>
      <header className="session-card__header">
        <div className="session-card__heading">
          <div className="session-card__date">
            <CalendarDays aria-hidden="true" size={16} />
            <time dateTime={session.enteredAt.toISOString()}>{dateLabel}</time>
          </div>
          <h2 className="session-card__title" id={titleId}>
            <LibraryBig aria-hidden="true" size={18} />
            {libraryTitle}
          </h2>
        </div>
        {actions ? <div className="session-card__actions">{actions}</div> : null}
      </header>

      <dl className="session-card__durations">
        <div className="session-card__duration">
          <dt>
            <Clock3 aria-hidden="true" size={16} />
            滞在
          </dt>
          <dd>{formatMinutes(session.stayMinutes)}</dd>
        </div>
        <div className="session-card__duration">
          <dt>
            <Timer aria-hidden="true" size={16} />
            実作業
          </dt>
          <dd>{formatMinutes(session.actualWorkMinutes)}</dd>
        </div>
      </dl>

      <dl className="session-card__scores" aria-label="作業時のスコア">
        {scoreItems.map(({ key, label }) => {
          const score = session[key];
          return (
            <div
              className={`session-card__score session-card__score--${key}`}
              key={key}
              aria-label={`${label} ${score}点、10点満点`}
            >
              <dt>{label}</dt>
              <dd>
                <strong>{score}</strong>
                <span aria-hidden="true">/10</span>
              </dd>
            </div>
          );
        })}
      </dl>

      <footer className="session-card__statuses">
        <div className="session-card__status">
          <span className="session-card__status-label">翌日</span>
          <NextDayReactionBadge reaction={session.nextDayReaction} />
        </div>
        <div className="session-card__status">
          <span className="session-card__status-label">終了</span>
          <CompletionStatusBadge status={session.completionStatus} />
        </div>
      </footer>
    </article>
  );
}

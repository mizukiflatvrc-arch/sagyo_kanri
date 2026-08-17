import { useEffect, useState } from "react";
import { Clock3, FilePenLine, LogIn, LogOut, Trash2 } from "lucide-react";
import type { ActiveSession } from "../types/activeSession";
import { formatJstDateTime } from "../utils/date";
import {
  formatElapsedTime,
  isActiveSessionFromPreviousJstDay,
} from "../utils/activeSession";

interface ActiveSessionCardProps {
  activeSession: ActiveSession | null;
  isProcessing: boolean;
  onEnter: () => void;
  onExit: () => void;
  onCancel: () => void;
}

export function ActiveSessionCard({
  activeSession,
  isProcessing,
  onEnter,
  onExit,
  onCancel,
}: ActiveSessionCardProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    if (!activeSession) return;
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, [activeSession]);

  if (!activeSession) {
    return (
      <section className="card welcome-card timecard-entry-card">
        <div>
          <p className="timecard-card__status">TIME CARD</p>
          <h2>図書館に着いたら、ここから記録を始めます。</h2>
          <p>
            入室時は場所や状態の入力は不要です。日報は退出した後に書けます。
          </p>
        </div>
        <button
          className="button timecard-primary-button"
          type="button"
          onClick={onEnter}
          disabled={isProcessing}
        >
          <LogIn aria-hidden="true" size={22} />
          {isProcessing ? "入室を記録中…" : "入室する"}
        </button>
      </section>
    );
  }

  const reportStarted = activeSession.exitStartedAt !== undefined;
  const isPreviousDay = isActiveSessionFromPreviousJstDay(
    activeSession.enteredAt,
    now,
  );

  return (
    <section
      className="card active-session-card"
      aria-labelledby="active-session-heading"
    >
      <div className="active-session-card__header">
        <span className="active-session-card__indicator" aria-hidden="true" />
        <div>
          <p className="timecard-card__status">
            {reportStarted ? "REPORT IN PROGRESS" : "NOW IN LIBRARY"}
          </p>
          <h2 id="active-session-heading">入室中</h2>
        </div>
      </div>

      <dl className="active-session-card__times">
        <div>
          <dt>開始</dt>
          <dd>
            <time dateTime={activeSession.enteredAt.toISOString()}>
              {formatJstDateTime(activeSession.enteredAt)}
            </time>
          </dd>
        </div>
        <div>
          <dt>
            <Clock3 aria-hidden="true" size={17} />
            経過
          </dt>
          <dd>
            {formatElapsedTime(
              activeSession.enteredAt,
              activeSession.exitStartedAt ?? now,
            )}
          </dd>
        </div>
        {activeSession.exitStartedAt ? (
          <div>
            <dt>退出確定</dt>
            <dd>
              <time dateTime={activeSession.exitStartedAt.toISOString()}>
                {formatJstDateTime(activeSession.exitStartedAt)}
              </time>
            </dd>
          </div>
        ) : null}
      </dl>

      {isPreviousDay ? (
        <p className="active-session-card__warning" role="status">
          前日から入室中になっています。入室日時と退出日時を確認してください。
        </p>
      ) : null}

      {reportStarted ? (
        <p className="active-session-card__hint">
          退出日時は固定されています。入力途中の日報を続けられます。
        </p>
      ) : null}

      <div className="active-session-card__actions">
        <button
          className="button button--primary timecard-primary-button"
          type="button"
          onClick={onExit}
          disabled={isProcessing}
        >
          {reportStarted ? (
            <FilePenLine aria-hidden="true" size={21} />
          ) : (
            <LogOut aria-hidden="true" size={21} />
          )}
          {isProcessing
            ? "処理中…"
            : reportStarted
              ? "日報入力を再開する"
              : "退出して日報を書く"}
        </button>
        <button
          className="button button--danger"
          type="button"
          onClick={onCancel}
          disabled={isProcessing}
        >
          <Trash2 aria-hidden="true" size={17} />
          入室記録を取り消す
        </button>
      </div>
    </section>
  );
}

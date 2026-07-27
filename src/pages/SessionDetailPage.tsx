import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  CalendarClock,
  ExternalLink,
  MapPin,
  Pencil,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import {
  CompletionStatusBadge,
  NextDayReactionBadge,
} from "../components/StatusBadge";
import { ErrorState, LoadingState } from "../components/States";
import { deleteSession } from "../services/sessions";
import { formatJstDate, formatJstDateTime } from "../utils/date";
import {
  COMPLETION_STATUS_LABELS,
  NEXT_DAY_REACTION_LABELS,
  formatMinutes,
} from "../utils/format";
import { toUserMessage } from "../utils/errors";

function textOrDash(value: string): string {
  return value.trim() || "—";
}

export function SessionDetailPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { sessions, libraryById, isLoading, error } = useData();
  const { showToast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const session = sessions.find((item) => item.id === sessionId);

  if (isLoading) return <LoadingState label="記録を読み込んでいます" />;
  if (error) {
    return <ErrorState title="記録を読み込めませんでした" description={error} />;
  }
  if (!session) {
    return (
      <ErrorState
        title="記録が見つかりません"
        description="削除されたか、URLが正しくない可能性があります。"
        action={
          <Link className="button button--secondary" to="/sessions">
            記録一覧へ戻る
          </Link>
        }
      />
    );
  }

  const library = libraryById.get(session.libraryId);
  const handleDelete = async () => {
    if (!user) return;
    setIsDeleting(true);
    try {
      await deleteSession(user.uid, session.id);
      showToast("記録を削除しました", "success");
      navigate("/sessions", { replace: true });
    } catch (deleteError) {
      showToast(toUserMessage(deleteError), "error");
      setIsDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow={formatJstDate(session.enteredAt)}
        title={library?.name ?? "登録済みの図書館"}
        description={`${formatJstDateTime(session.enteredAt)} 〜 ${formatJstDateTime(session.exitedAt)}`}
        backTo="/sessions"
        backLabel="記録一覧"
        actions={
          <>
            <Link className="button button--secondary" to={`/sessions/${session.id}/edit`}>
              <Pencil size={17} /> 編集
            </Link>
            <button
              className="button button--danger"
              type="button"
              onClick={() => setConfirmOpen(true)}
            >
              <Trash2 size={17} /> 削除
            </button>
          </>
        }
      />

      <div className="detail-layout">
        <article className="card">
          <section className="detail-section">
            <h2>利用時間</h2>
            <dl className="detail-list">
              <div className="detail-item">
                <dt>利用日</dt>
                <dd>{formatJstDate(session.enteredAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>図書館</dt>
                <dd>{library?.name ?? "削除済みの図書館"}</dd>
              </div>
              <div className="detail-item">
                <dt>入室</dt>
                <dd>{formatJstDateTime(session.enteredAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>退室</dt>
                <dd>{formatJstDateTime(session.exitedAt)}</dd>
              </div>
              <div className="detail-item">
                <dt>滞在時間</dt>
                <dd>{formatMinutes(session.stayMinutes)}</dd>
              </div>
              <div className="detail-item">
                <dt>実作業時間</dt>
                <dd>{formatMinutes(session.actualWorkMinutes)}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-section">
            <h2>作業中の状態</h2>
            <dl className="detail-list">
              <div className="detail-item">
                <dt>集中度</dt>
                <dd>{session.concentrationScore} / 10</dd>
              </div>
              <div className="detail-item">
                <dt>焦り</dt>
                <dd>{session.anxietyScore} / 10</dd>
              </div>
              <div className="detail-item">
                <dt>終了直後の疲労</dt>
                <dd>{session.fatigueScore} / 10</dd>
              </div>
              <div className="detail-item">
                <dt>自己否定していた時間</dt>
                <dd>{formatMinutes(session.selfCriticismMinutes)}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-section">
            <h2>予定と実際の作業</h2>
            <dl className="detail-list">
              <div className="detail-item">
                <dt>開始時に予定タスクを設定</dt>
                <dd>{session.plannedTaskCreated ? "はい" : "いいえ"}</dd>
              </div>
              <div className="detail-item">
                <dt>終了状況</dt>
                <dd>{COMPLETION_STATUS_LABELS[session.completionStatus]}</dd>
              </div>
              <div className="detail-item detail-item--wide">
                <dt>予定タスク</dt>
                <dd>{textOrDash(session.plannedTaskText)}</dd>
              </div>
              <div className="detail-item detail-item--wide">
                <dt>実際に行った作業</dt>
                <dd>{textOrDash(session.actualTaskText)}</dd>
              </div>
            </dl>
          </section>

          <section className="detail-section">
            <h2>翌日の状態とメモ</h2>
            <dl className="detail-list">
              <div className="detail-item">
                <dt>翌日の反動</dt>
                <dd>{NEXT_DAY_REACTION_LABELS[session.nextDayReaction]}</dd>
              </div>
              <div className="detail-item detail-item--wide">
                <dt>翌日の補足メモ</dt>
                <dd>{textOrDash(session.nextDayNote)}</dd>
              </div>
              <div className="detail-item detail-item--wide">
                <dt>自由メモ</dt>
                <dd>{textOrDash(session.note)}</dd>
              </div>
            </dl>
          </section>
        </article>

        <aside className="card detail-aside" aria-label="記録の操作">
          <h2>記録の概要</h2>
          <CompletionStatusBadge status={session.completionStatus} />
          <NextDayReactionBadge reaction={session.nextDayReaction} />

          {session.nextDayReaction === "pending" && (
            <div className="quiet-callout">
              <p>
                <RefreshCw size={16} aria-hidden="true" /> 翌日の様子は、わかるときに追記できます。
              </p>
              <Link
                className="button button--primary button--full"
                to={`/sessions/${session.id}/next-day`}
              >
                翌日の様子を記録
              </Link>
            </div>
          )}
          {session.nextDayReaction !== "pending" && (
            <Link
              className="button button--secondary button--full"
              to={`/sessions/${session.id}/next-day`}
            >
              <RefreshCw size={16} />
              翌日の様子を編集
            </Link>
          )}

          {library?.googleMapsUrl && (
            <a
              className="button button--secondary button--full"
              href={library.googleMapsUrl}
              target="_blank"
              rel="noreferrer"
            >
              <MapPin size={17} />
              Googleマップで開く
              <ExternalLink size={14} aria-label="新しいタブで開きます" />
            </a>
          )}
          <p className="field-help">
            <CalendarClock size={14} aria-hidden="true" /> 最終更新:{" "}
            {formatJstDateTime(session.updatedAt)}
          </p>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="この記録を削除しますか？"
        description="削除後は元に戻せません。保存されている更新前データも削除されます。"
        confirmLabel="削除する"
        isPending={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </div>
  );
}

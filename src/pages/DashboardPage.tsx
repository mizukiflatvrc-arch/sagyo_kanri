import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Activity,
  BatteryMedium,
  BookOpen,
  CalendarDays,
  CircleAlert,
  Clock3,
  Hourglass,
  Plus,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { SessionCard } from "../components/SessionCard";
import { ActiveSessionCard } from "../components/ActiveSessionCard";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { formatMinutes } from "../utils/format";
import {
  cancelActiveSession,
  startActiveSession,
  startActiveSessionExit,
} from "../services/activeSessions";
import { toUserMessage } from "../utils/errors";

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    sessions,
    libraries,
    libraryById,
    activeSession,
    isLoading,
    error,
    isActiveSessionLoading,
    activeSessionError,
  } = useData();
  const { showToast } = useToast();
  const [isTimecardProcessing, setIsTimecardProcessing] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  if (isLoading) {
    return <LoadingState label="記録を読み込んでいます" />;
  }
  if (error) {
    return <ErrorState title="記録を読み込めませんでした" description={error} />;
  }

  const pending = sessions.filter(
    (session) =>
      !session.isLegacyEncrypted && session.nextDayReaction === "pending",
  );
  const since = Date.now() - 30 * 24 * 60 * 60 * 1_000;
  const recentPeriod = sessions.filter(
    (session) => session.enteredAt.getTime() >= since,
  );

  const handleEnter = async () => {
    if (!user || isTimecardProcessing) return;
    setIsTimecardProcessing(true);
    try {
      await startActiveSession(user.uid);
      showToast("入室を記録しました", "success");
    } catch (startError) {
      showToast(toUserMessage(startError), "error");
    } finally {
      setIsTimecardProcessing(false);
    }
  };

  const handleExit = async () => {
    if (!user || isTimecardProcessing) return;
    setIsTimecardProcessing(true);
    try {
      await startActiveSessionExit(user.uid);
      navigate("/sessions/active/report");
    } catch (exitError) {
      showToast(toUserMessage(exitError), "error");
      setIsTimecardProcessing(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !activeSession || isTimecardProcessing) return;
    setIsTimecardProcessing(true);
    try {
      const cancelled = await cancelActiveSession(
        user.uid,
        activeSession.enteredAt,
      );
      setIsCancelOpen(false);
      showToast(
        cancelled
          ? "入室記録を取り消しました"
          : "入室記録はすでに削除されています",
        cancelled ? "success" : "info",
      );
    } catch (cancelError) {
      showToast(toUserMessage(cancelError), "error");
    } finally {
      setIsTimecardProcessing(false);
    }
  };

  return (
    <div className="page">
      <header className="page-header">
        <div className="page-header__copy">
          <p className="page-header__eyebrow">OVERVIEW</p>
          <h1 tabIndex={-1}>ホーム</h1>
          <p className="page-header__description">
            作業量を評価せず、記録した事実をそのまま振り返れます。
          </p>
        </div>
      </header>

      <div className="hero-grid">
        {activeSessionError ? (
          <section className="card timecard-unavailable-card" role="status">
            <CircleAlert aria-hidden="true" size={25} />
            <div>
              <h2>入退室機能を読み込めませんでした</h2>
              <p>
                {activeSessionError}
                過去の記録や図書館は引き続き利用できます。
              </p>
            </div>
          </section>
        ) : isActiveSessionLoading ? (
          <section
            className="card timecard-unavailable-card"
            aria-busy="true"
          >
            <Clock3 aria-hidden="true" size={25} />
            <div>
              <h2>入退室状態を確認しています</h2>
              <p>このまま少しお待ちください。</p>
            </div>
          </section>
        ) : (
          <ActiveSessionCard
            activeSession={activeSession}
            isProcessing={isTimecardProcessing}
            onEnter={() => void handleEnter()}
            onExit={() => void handleExit()}
            onCancel={() => setIsCancelOpen(true)}
          />
        )}

        <section className="card pending-card" aria-labelledby="pending-heading">
          <div className="pending-card__icon" aria-hidden="true">
            <Hourglass size={21} />
          </div>
          <div>
            <p className="pending-card__number">{pending.length}</p>
            <p className="pending-card__label" id="pending-heading">
              翌日確認待ち
            </p>
          </div>
          <Link
            className="button button--secondary button--small"
            to={pending[0] ? `/sessions/${pending[0].id}/next-day` : "/sessions"}
          >
            {pending.length > 0 ? "あとから記録" : "履歴を見る"}
          </Link>
        </section>
      </div>
      <div className="timecard-secondary-action">
        <Link className="button button--secondary button--small" to="/sessions/new">
          <Plus size={16} />
          過去の記録を追加
        </Link>
        <span>日時を手入力して完成済みの記録を追加できます。</span>
      </div>

      <div className="section-heading">
        <div>
          <h2>直近30日の記録</h2>
          <p>傾向を断定せず、期間内の数値だけを表示しています。</p>
        </div>
      </div>
      <section className="stat-grid" aria-label="直近30日の集計">
        <article className="card stat-card">
          <p className="stat-card__label">
            <CalendarDays size={15} /> 利用回数
          </p>
          <p className="stat-card__value">{recentPeriod.length}回</p>
        </article>
        <article className="card stat-card">
          <p className="stat-card__label">
            <Clock3 size={15} /> 平均滞在時間
          </p>
          <p className="stat-card__value">
            {recentPeriod.length > 0
              ? formatMinutes(
                  Math.round(average(recentPeriod.map((item) => item.stayMinutes))),
                )
              : "—"}
          </p>
        </article>
        <article className="card stat-card">
          <p className="stat-card__label">
            <BatteryMedium size={15} /> 平均疲労度
          </p>
          <p className="stat-card__value">
            {recentPeriod.length > 0
              ? average(recentPeriod.map((item) => item.fatigueScore)).toFixed(1)
              : "—"}
            {recentPeriod.length > 0 && <small> / 10</small>}
          </p>
        </article>
        <article className="card stat-card">
          <p className="stat-card__label">
            <Activity size={15} /> 平均集中度
          </p>
          <p className="stat-card__value">
            {recentPeriod.length > 0
              ? average(recentPeriod.map((item) => item.concentrationScore)).toFixed(1)
              : "—"}
            {recentPeriod.length > 0 && <small> / 10</small>}
          </p>
        </article>
      </section>

      <div className="section-heading">
        <div>
          <h2>最近の記録</h2>
          <p>新しい順に5件</p>
        </div>
        {sessions.length > 0 && <Link to="/sessions">すべて見る</Link>}
      </div>
      {sessions.length === 0 ? (
        <EmptyState
          icon={<BookOpen size={25} />}
          title="まだ記録はありません"
          description={
            libraries.length === 0
              ? "最初に図書館を登録すると、作業記録を追加できます。"
              : "最初の作業記録を追加できます。"
          }
          action={
            <Link
              className="button button--primary"
              to={libraries.length === 0 ? "/libraries/new" : "/sessions/new"}
            >
              <Plus size={18} />
              {libraries.length === 0 ? "図書館を登録" : "最初の記録を追加"}
            </Link>
          }
        />
      ) : (
        <div className="session-list">
          {sessions.slice(0, 5).map((session) => (
            <SessionCard
              key={session.id}
              session={session}
              libraryName={libraryById.get(session.libraryId)?.name}
              to={`/sessions/${session.id}`}
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={isCancelOpen}
        title="入室記録を取り消しますか？"
        description={
          activeSession?.exitStartedAt
            ? "退出日時は確定済みで、日報入力途中の内容が失われる可能性があります。この入室中の記録はまだ日報として保存されていません。"
            : "この入室中の記録を削除します。まだ日報として保存されていません。"
        }
        confirmLabel="入室記録を削除"
        pendingLabel="削除中…"
        isPending={isTimecardProcessing}
        onConfirm={() => void handleCancel()}
        onClose={() => setIsCancelOpen(false)}
      />
    </div>
  );
}

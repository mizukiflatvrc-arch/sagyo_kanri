import { Link } from "react-router-dom";
import {
  Activity,
  BookOpen,
  CalendarDays,
  Clock3,
  Hourglass,
  Plus,
} from "lucide-react";
import { useData } from "../contexts/DataContext";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { SessionCard } from "../components/SessionCard";
import { formatMinutes } from "../utils/format";

function average(values: number[]): number {
  return values.length === 0
    ? 0
    : values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function DashboardPage() {
  const { sessions, libraries, libraryById, isLoading, error } = useData();

  if (isLoading) {
    return <LoadingState label="記録を読み込んでいます" />;
  }
  if (error) {
    return <ErrorState title="記録を読み込めませんでした" description={error} />;
  }

  const pending = sessions.filter(
    (session) => session.nextDayReaction === "pending",
  );
  const since = Date.now() - 30 * 24 * 60 * 60 * 1_000;
  const recentPeriod = sessions.filter(
    (session) => session.enteredAt.getTime() >= since,
  );

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
        <section className="card welcome-card">
          <div>
            <h2>今日の図書館での時間を、残しておきますか。</h2>
            <p>
              滞在時間、作業中の状態、実際に取り組んだことを自分のペースで記録できます。
            </p>
          </div>
          <Link className="button" to="/sessions/new">
            <Plus size={18} />
            新しい記録
          </Link>
        </section>

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
            <BookOpen size={15} /> 平均実作業時間
          </p>
          <p className="stat-card__value">
            {recentPeriod.length > 0
              ? formatMinutes(
                  Math.round(
                    average(recentPeriod.map((item) => item.actualWorkMinutes)),
                  ),
                )
              : "—"}
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
    </div>
  );
}

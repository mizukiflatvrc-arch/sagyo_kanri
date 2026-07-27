import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Filter, Plus, RotateCcw } from "lucide-react";
import { useData } from "../contexts/DataContext";
import { PageHeader } from "../components/PageHeader";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { SessionCard } from "../components/SessionCard";
import {
  COMPLETION_STATUS_OPTIONS,
  NEXT_DAY_REACTION_OPTIONS,
} from "../utils/format";
import { toJstDateKey } from "../utils/date";
import {
  COMPLETION_STATUSES,
  NEXT_DAY_REACTIONS,
  type CompletionStatus,
  type NextDayReaction,
} from "../types";

function isDateFilter(value: string): boolean {
  return value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isCompletionStatus(value: string): value is CompletionStatus {
  return (COMPLETION_STATUSES as readonly string[]).includes(value);
}

function isNextDayReaction(value: string): value is NextDayReaction {
  return (NEXT_DAY_REACTIONS as readonly string[]).includes(value);
}

export function SessionsPage() {
  const { sessions, libraries, libraryById, isLoading, error } = useData();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedFrom = searchParams.get("from") ?? "";
  const requestedTo = searchParams.get("to") ?? "";
  const requestedLibrary = searchParams.get("library") ?? "";
  const requestedReaction = searchParams.get("reaction") ?? "";
  const requestedCompletion = searchParams.get("completion") ?? "";
  const dateFrom = isDateFilter(requestedFrom) ? requestedFrom : "";
  const dateTo = isDateFilter(requestedTo) ? requestedTo : "";
  const libraryId = libraries.some((library) => library.id === requestedLibrary)
    ? requestedLibrary
    : "";
  const reaction = isNextDayReaction(requestedReaction)
    ? requestedReaction
    : "";
  const completion = isCompletionStatus(requestedCompletion)
    ? requestedCompletion
    : "";

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  };

  const filteredSessions = useMemo(
    () =>
      sessions.filter((session) => {
        const dateKey = toJstDateKey(session.enteredAt);
        return (
          (!dateFrom || dateKey >= dateFrom) &&
          (!dateTo || dateKey <= dateTo) &&
          (!libraryId || session.libraryId === libraryId) &&
          (!reaction || session.nextDayReaction === reaction) &&
          (!completion || session.completionStatus === completion)
        );
      }),
    [completion, dateFrom, dateTo, libraryId, reaction, sessions],
  );

  const resetFilters = () => {
    setSearchParams({}, { replace: true });
  };
  const hasFilters = Boolean(
    dateFrom || dateTo || libraryId || reaction || completion,
  );

  if (isLoading) return <LoadingState label="記録を読み込んでいます" />;
  if (error) {
    return <ErrorState title="記録を読み込めませんでした" description={error} />;
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="SESSIONS"
        title="作業記録"
        description="期間や図書館を絞り込み、これまでの記録を新しい順に確認できます。"
        actions={
          <Link className="button button--primary" to="/sessions/new">
            <Plus size={18} />
            新しい記録
          </Link>
        }
      />

      <section className="card card--flat filter-bar" aria-label="記録の絞り込み">
        <div className="field">
          <label htmlFor="filter-library">図書館</label>
          <select
            className="select"
            id="filter-library"
            value={libraryId}
            onChange={(event) => setFilter("library", event.target.value)}
          >
            <option value="">すべての図書館</option>
            {libraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-from">開始日</label>
          <input
            className="input"
            id="filter-from"
            type="date"
            value={dateFrom}
            max={dateTo || undefined}
            onChange={(event) => setFilter("from", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-to">終了日</label>
          <input
            className="input"
            id="filter-to"
            type="date"
            value={dateTo}
            min={dateFrom || undefined}
            onChange={(event) => setFilter("to", event.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="filter-reaction">翌日の反動</label>
          <select
            className="select"
            id="filter-reaction"
            value={reaction}
            onChange={(event) => setFilter("reaction", event.target.value)}
          >
            <option value="">すべて</option>
            {NEXT_DAY_REACTION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="filter-completion">終了状況</label>
          <select
            className="select"
            id="filter-completion"
            value={completion}
            onChange={(event) => setFilter("completion", event.target.value)}
          >
            <option value="">すべて</option>
            {COMPLETION_STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <button
          className="button button--ghost button--small"
          type="button"
          disabled={!hasFilters}
          onClick={resetFilters}
        >
          <RotateCcw size={15} />
          リセット
        </button>
      </section>

      <div className="section-heading" role="status" aria-live="polite">
        <div>
          <h2>
            <Filter size={16} aria-hidden="true" /> {filteredSessions.length}件
          </h2>
          <p>{hasFilters ? `全${sessions.length}件から絞り込み` : "新しい順"}</p>
        </div>
      </div>

      {filteredSessions.length === 0 ? (
        <EmptyState
          title={hasFilters ? "条件に合う記録がありません" : "まだ記録はありません"}
          description={
            hasFilters
              ? "絞り込み条件を変えて、もう一度お試しください。"
              : "図書館での作業を終えたときに、最初の記録を追加できます。"
          }
          action={
            hasFilters ? (
              <button className="button button--secondary" type="button" onClick={resetFilters}>
                絞り込みを解除
              </button>
            ) : (
              <Link className="button button--primary" to="/sessions/new">
                <Plus size={18} /> 新しい記録
              </Link>
            )
          }
        />
      ) : (
        <div className="session-list">
          {filteredSessions.map((session) => (
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

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LibraryBig, Plus } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { TimecardReportForm } from "../components/TimecardReportForm";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { completeActiveSession } from "../services/activeSessions";
import { toJstDateTimeLocal } from "../utils/date";
import { toUserMessage } from "../utils/errors";
import type { ParsedTimecardReport } from "../utils/timecardReport";

export function ActiveSessionReportPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    activeSession,
    libraries,
    isLoading,
    error,
    isActiveSessionLoading,
    activeSessionError,
  } = useData();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const initialValues = useMemo(
    () =>
      activeSession?.exitStartedAt
        ? {
            libraryId: "",
            enteredAt: toJstDateTimeLocal(activeSession.enteredAt),
            exitedAt: toJstDateTimeLocal(activeSession.exitStartedAt),
            concentrationScore: 5,
            anxietyScore: 5,
            fatigueScore: 5,
            selfCriticismScore: 0,
            plannedTaskCreated: false,
            plannedTaskText: "",
            actualTaskText: "",
            completionStatus: "on_schedule" as const,
            note: "",
          }
        : null,
    [activeSession],
  );

  if (isLoading || isActiveSessionLoading) {
    return <LoadingState label="日報入力画面を準備しています" />;
  }
  if (error) {
    return (
      <ErrorState
        title="日報入力画面を準備できませんでした"
        description={error}
      />
    );
  }
  if (activeSessionError) {
    return (
      <ErrorState
        title="入室中の記録を読み込めませんでした"
        description={activeSessionError}
        action={
          <Link className="button button--secondary" to="/">
            ホームへ戻る
          </Link>
        }
      />
    );
  }
  if (!activeSession || !initialValues) {
    return (
      <ErrorState
        title="入室中の記録が見つかりません"
        description="すでに日報として保存されたか、入室記録が取り消された可能性があります。"
        action={
          <Link className="button button--secondary" to="/">
            ホームへ戻る
          </Link>
        }
      />
    );
  }
  if (libraries.length === 0) {
    return (
      <div className="page page--narrow">
        <PageHeader title="退出後の日報" backTo="/" backLabel="ホーム" />
        <EmptyState
          icon={<LibraryBig size={25} />}
          title="先に図書館を登録します"
          description="入室記録はそのまま残ります。図書館を登録した後、ホームから日報入力を再開できます。"
          action={
            <Link className="button button--primary" to="/libraries/new">
              <Plus size={18} />
              図書館を登録
            </Link>
          }
        />
      </div>
    );
  }

  const handleSubmit = async (values: ParsedTimecardReport) => {
    if (!user || isSaving) return;
    setIsSaving(true);
    try {
      const sessionId = await completeActiveSession(user.uid, {
        ...values,
        activeEnteredAt: activeSession.enteredAt,
      });
      showToast("日報を保存しました", "success");
      navigate(`/sessions/${sessionId}`, { replace: true });
    } catch (saveError) {
      showToast(toUserMessage(saveError), "error");
      setIsSaving(false);
    }
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow="CHECK OUT"
        title="退出後の日報"
        description="滞在できたことと、そのときの状態をわかる範囲で残します。実作業時間は入力しません。"
        backTo="/"
        backLabel="ホーム"
      />
      <div className="card form-card">
        <TimecardReportForm
          key={`${activeSession.enteredAt.getTime()}-${activeSession.exitStartedAt?.getTime() ?? ""}`}
          initialValues={initialValues}
          libraries={libraries}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/")}
        />
      </div>
    </div>
  );
}

import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { NextDayReactionFormValues } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/PageHeader";
import { NextDayReactionForm } from "../components/NextDayReactionForm";
import { ErrorState, LoadingState } from "../components/States";
import { updateNextDayReaction } from "../services/sessions";
import { formatJstDate } from "../utils/date";
import { formatMinutes } from "../utils/format";
import { toUserMessage } from "../utils/errors";
import { useEncryption } from "../contexts/EncryptionContext";

export function NextDayPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { key } = useEncryption();
  const { sessions, libraryById, isLoading, error } = useData();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const session = sessions.find((item) => item.id === sessionId);
  const editBase = useRef<{ id: string; updatedAt: Date } | null>(null);
  if (session && editBase.current?.id !== session.id) {
    editBase.current = { id: session.id, updatedAt: session.updatedAt };
  }

  if (isLoading) return <LoadingState label="記録を読み込んでいます" />;
  if (error) {
    return <ErrorState title="記録を読み込めませんでした" description={error} />;
  }
  if (!session) {
    return (
      <ErrorState
        title="記録が見つかりません"
        description="削除されたか、URLが正しくない可能性があります。"
        action={<Link to="/sessions">記録一覧へ戻る</Link>}
      />
    );
  }

  const handleSubmit = async (values: NextDayReactionFormValues) => {
    if (!user || !key) return;
    setIsSaving(true);
    try {
      await updateNextDayReaction(
        user.uid,
        session.id,
        values.nextDayReaction,
        values.nextDayNote,
        key,
        editBase.current?.updatedAt,
      );
      showToast("翌日の様子を保存しました", "success");
      navigate(`/sessions/${session.id}`, { replace: true });
    } catch (saveError) {
      showToast(toUserMessage(saveError), "error");
      setIsSaving(false);
    }
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow="NEXT DAY"
        title="翌日の様子を記録"
        description="反動の有無や強さを、わかる範囲で後から追記できます。"
        backTo={`/sessions/${session.id}`}
        backLabel="記録詳細"
      />
      <section className="card card--padded" aria-labelledby="session-summary">
        <h2 id="session-summary">対象の記録</h2>
        <dl className="detail-list">
          <div className="detail-item">
            <dt>利用日</dt>
            <dd>{formatJstDate(session.enteredAt)}</dd>
          </div>
          <div className="detail-item">
            <dt>図書館</dt>
            <dd>{libraryById.get(session.libraryId)?.name ?? "登録済みの図書館"}</dd>
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
      <div className="card form-card" style={{ marginTop: 16 }}>
        <NextDayReactionForm
          key={session.id}
          initialValues={{
            nextDayReaction: session.nextDayReaction,
            nextDayNote: session.nextDayNote,
          }}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => navigate(`/sessions/${session.id}`)}
        />
      </div>
    </div>
  );
}

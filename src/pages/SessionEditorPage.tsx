import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { LibraryBig, Plus } from "lucide-react";
import type { EditableLibrarySessionFields } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/PageHeader";
import { SessionForm } from "../components/SessionForm";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { createEmptySessionFormValues, sessionToFormValues } from "../utils/format";
import { createSession, updateSession } from "../services/sessions";
import { toUserMessage } from "../utils/errors";
import { useEncryption } from "../contexts/EncryptionContext";

export function SessionEditorPage() {
  const { sessionId } = useParams();
  const isEdit = Boolean(sessionId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { key } = useEncryption();
  const { sessions, libraries, libraryById, isLoading, error } = useData();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const target = sessions.find((session) => session.id === sessionId);
  const editBase = useRef<{ id: string; updatedAt: Date } | null>(null);
  if (target && editBase.current?.id !== target.id) {
    editBase.current = { id: target.id, updatedAt: target.updatedAt };
  }
  const targetLibrary = target ? libraryById.get(target.libraryId) : undefined;
  const selectableLibraries =
    targetLibrary &&
    !libraries.some((library) => library.id === targetLibrary.id)
      ? [targetLibrary, ...libraries]
      : libraries;

  if (isLoading) return <LoadingState label="入力画面を準備しています" />;
  if (error) {
    return <ErrorState title="入力画面を準備できませんでした" description={error} />;
  }
  if (isEdit && !target) {
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
  if (selectableLibraries.length === 0) {
    return (
      <div className="page page--narrow">
        <PageHeader
          title={isEdit ? "記録を編集" : "新しい記録"}
          backTo={isEdit && sessionId ? `/sessions/${sessionId}` : "/"}
        />
        <EmptyState
          icon={<LibraryBig size={25} />}
          title="先に図書館を登録します"
          description="作業した場所を選べるように、図書館名を1件以上登録してください。"
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

  const handleSubmit = async (values: EditableLibrarySessionFields) => {
    if (!user || !key) return;
    setIsSaving(true);
    try {
      if (isEdit && sessionId) {
        await updateSession(
          user.uid,
          sessionId,
          values,
          key,
          editBase.current?.updatedAt,
        );
        showToast("記録を更新しました", "success");
        navigate(`/sessions/${sessionId}`, { replace: true });
      } else {
        const newId = await createSession(user.uid, values, key);
        showToast("記録を保存しました", "success");
        navigate(`/sessions/${newId}`, { replace: true });
      }
    } catch (saveError) {
      showToast(toUserMessage(saveError), "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={isEdit ? "EDIT SESSION" : "NEW SESSION"}
        title={isEdit ? "記録を編集" : "新しい記録"}
        description="入力した数値に良し悪しはありません。今の状態を、そのまま残せます。"
        backTo={isEdit && sessionId ? `/sessions/${sessionId}` : "/sessions"}
      />
      <div className="card form-card">
        <SessionForm
          key={target?.id ?? "new-session"}
          mode={isEdit ? "edit" : "create"}
          initialValues={
            target ? sessionToFormValues(target) : createEmptySessionFormValues()
          }
          libraries={selectableLibraries}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() =>
            navigate(isEdit && sessionId ? `/sessions/${sessionId}` : "/sessions")
          }
        />
      </div>
    </div>
  );
}

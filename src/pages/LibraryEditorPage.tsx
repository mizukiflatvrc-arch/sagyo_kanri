import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { EditableLibraryFields } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/PageHeader";
import { LibraryForm } from "../components/LibraryForm";
import { ErrorState, LoadingState } from "../components/States";
import { createLibrary, updateLibrary } from "../services/libraries";
import { toUserMessage } from "../utils/errors";

export function LibraryEditorPage() {
  const { libraryId } = useParams();
  const isEdit = Boolean(libraryId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { libraries, isLoading, error } = useData();
  const { showToast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const target = libraries.find((library) => library.id === libraryId);
  const editBase = useRef<{ id: string; updatedAt: Date } | null>(null);
  if (target && editBase.current?.id !== target.id) {
    editBase.current = { id: target.id, updatedAt: target.updatedAt };
  }

  if (isLoading) return <LoadingState label="入力画面を準備しています" />;
  if (error) {
    return <ErrorState title="入力画面を準備できませんでした" description={error} />;
  }
  if (isEdit && !target) {
    return (
      <ErrorState
        title="図書館が見つかりません"
        description="削除されたか、URLが正しくない可能性があります。"
        action={<Link to="/libraries">図書館一覧へ戻る</Link>}
      />
    );
  }

  const handleSubmit = async (values: EditableLibraryFields) => {
    if (!user) return;
    setIsSaving(true);
    try {
      if (isEdit && libraryId) {
        await updateLibrary(
          user.uid,
          libraryId,
          values,
          editBase.current?.updatedAt,
        );
        showToast("図書館を更新しました", "success");
      } else {
        await createLibrary(user.uid, values);
        showToast("図書館を登録しました", "success");
      }
      navigate("/libraries", { replace: true });
    } catch (saveError) {
      showToast(toUserMessage(saveError), "error");
      setIsSaving(false);
    }
  };

  return (
    <div className="page page--narrow">
      <PageHeader
        eyebrow={isEdit ? "EDIT LIBRARY" : "NEW LIBRARY"}
        title={isEdit ? "図書館を編集" : "図書館を登録"}
        description="図書館名は必須です。マップURLと位置情報は必要な場合だけ入力できます。"
        backTo="/libraries"
        backLabel="図書館一覧"
      />
      <div className="card form-card">
        <LibraryForm
          key={target?.id ?? "new-library"}
          mode={isEdit ? "edit" : "create"}
          initialValues={{
            name: target?.name ?? "",
            googleMapsUrl: target?.googleMapsUrl ?? "",
            latitude: target?.latitude === undefined ? "" : String(target.latitude),
            longitude:
              target?.longitude === undefined ? "" : String(target.longitude),
          }}
          isSaving={isSaving}
          onSubmit={handleSubmit}
          onCancel={() => navigate("/libraries")}
        />
      </div>
    </div>
  );
}

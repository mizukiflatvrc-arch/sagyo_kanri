import { useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, LibraryBig, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import type { Library } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import { useToast } from "../contexts/ToastContext";
import { PageHeader } from "../components/PageHeader";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import {
  deleteLibrary,
  LibraryInUseError,
} from "../services/libraries";
import { toUserMessage } from "../utils/errors";

export function LibrariesPage() {
  const { user } = useAuth();
  const { libraries, sessions, isLoading, error } = useData();
  const { showToast } = useToast();
  const [deleteTarget, setDeleteTarget] = useState<Library | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  if (isLoading) return <LoadingState label="図書館を読み込んでいます" />;
  if (error) {
    return <ErrorState title="図書館を読み込めませんでした" description={error} />;
  }

  const usageCount = (libraryId: string) =>
    sessions.filter((session) => session.libraryId === libraryId).length;

  const handleDelete = async () => {
    if (!user || !deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteLibrary(user.uid, deleteTarget.id);
      showToast("図書館を削除しました", "success");
      setDeleteTarget(null);
    } catch (deleteError) {
      showToast(
        deleteError instanceof LibraryInUseError
          ? deleteError.message
          : toUserMessage(deleteError),
        "error",
      );
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        eyebrow="LIBRARIES"
        title="図書館"
        description="よく利用する図書館を登録し、記録時に選択できます。"
        actions={
          <Link className="button button--primary" to="/libraries/new">
            <Plus size={18} /> 図書館を登録
          </Link>
        }
      />

      {libraries.length === 0 ? (
        <EmptyState
          icon={<LibraryBig size={25} />}
          title="図書館はまだ登録されていません"
          description="図書館名と、必要であればGoogleマップのURLを登録できます。"
          action={
            <Link className="button button--primary" to="/libraries/new">
              <Plus size={18} /> 最初の図書館を登録
            </Link>
          }
        />
      ) : (
        <div className="library-list">
          {libraries.map((library) => {
            const count = usageCount(library.id);
            return (
              <article className="card library-card" key={library.id}>
                <div className="library-card__icon" aria-hidden="true">
                  <LibraryBig size={20} />
                </div>
                <div className="library-card__copy">
                  <h2>{library.name}</h2>
                  <p>
                    {count > 0
                      ? `${count}件の記録で使用中`
                      : "まだ記録では使用されていません"}
                  </p>
                </div>
                <div className="library-card__actions">
                  {library.googleMapsUrl && (
                    <a
                      className="button button--ghost button--small"
                      href={library.googleMapsUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MapPin size={16} /> マップ
                      <ExternalLink size={12} aria-label="新しいタブで開きます" />
                    </a>
                  )}
                  <Link
                    className="button button--ghost button--small"
                    to={`/libraries/${library.id}/edit`}
                  >
                    <Pencil size={15} /> 編集
                  </Link>
                  <button
                    className="button button--ghost button--small"
                    type="button"
                    disabled={count > 0}
                    title={
                      count > 0
                        ? `${count}件の記録で使用中のため削除できません`
                        : "図書館を削除"
                    }
                    onClick={() => setDeleteTarget(library)}
                  >
                    <Trash2 size={15} /> 削除
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="この図書館を削除しますか？"
        description={`${deleteTarget?.name ?? "この図書館"}を一覧から削除します。`}
        confirmLabel="削除する"
        isPending={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

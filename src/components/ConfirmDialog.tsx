import {
  useEffect,
  useId,
  useRef,
  type MouseEvent,
  type ReactNode,
} from "react";
import { CircleAlert, X } from "lucide-react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel?: string | undefined;
  cancelLabel?: string | undefined;
  pendingLabel?: string | undefined;
  isPending?: boolean | undefined;
  tone?: "danger" | "primary" | undefined;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * A native modal dialog with a safe initial focus on the cancel action.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "削除する",
  cancelLabel = "キャンセル",
  pendingLabel = "処理中…",
  isPending = false,
  tone = "danger",
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
      }
      cancelButtonRef.current?.focus();
      return;
    }

    if (!open && dialog.open) {
      if (typeof dialog.close === "function") {
        dialog.close();
      } else {
        dialog.removeAttribute("open");
      }
    }
  }, [open]);

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (!isPending && event.target === event.currentTarget) {
      onClose();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      aria-busy={isPending}
      onCancel={(event) => {
        event.preventDefault();
        if (!isPending) onClose();
      }}
      onClick={handleBackdropClick}
    >
      <div className="confirm-dialog__panel">
        <button
          className="icon-button confirm-dialog__close"
          type="button"
          onClick={onClose}
          disabled={isPending}
          aria-label="確認画面を閉じる"
        >
          <X aria-hidden="true" size={19} />
        </button>

        <span
          className={`confirm-dialog__icon confirm-dialog__icon--${tone}`}
          aria-hidden="true"
        >
          <CircleAlert size={26} />
        </span>
        <h2 className="confirm-dialog__title" id={titleId}>
          {title}
        </h2>
        {description ? (
          <div className="confirm-dialog__description" id={descriptionId}>
            {description}
          </div>
        ) : null}

        <div className="confirm-dialog__actions">
          <button
            ref={cancelButtonRef}
            className="button button--secondary"
            type="button"
            onClick={onClose}
            disabled={isPending}
            autoFocus
          >
            {cancelLabel}
          </button>
          <button
            className={`button button--${tone}`}
            type="button"
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

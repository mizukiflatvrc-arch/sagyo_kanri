import { useEffect, useId, useRef, type ReactNode } from "react";
import { CircleAlert } from "lucide-react";

interface NoticeDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  closeLabel?: string;
  onClose: () => void;
}

export function NoticeDialog({
  open,
  title,
  description,
  closeLabel = "確認",
  onClose,
}: NoticeDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
      buttonRef.current?.focus();
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="confirm-dialog"
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="confirm-dialog__panel">
        <span
          className="confirm-dialog__icon confirm-dialog__icon--primary"
          aria-hidden="true"
        >
          <CircleAlert size={26} />
        </span>
        <h2 className="confirm-dialog__title" id={titleId}>
          {title}
        </h2>
        <div className="confirm-dialog__description" id={descriptionId}>
          {description}
        </div>
        <div className="confirm-dialog__actions">
          <button
            ref={buttonRef}
            className="button button--primary"
            type="button"
            onClick={onClose}
            autoFocus
          >
            {closeLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

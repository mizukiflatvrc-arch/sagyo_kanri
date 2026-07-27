import type { ReactNode } from "react";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  eyebrow?: ReactNode;
  backTo?: string | undefined;
  backLabel?: string | undefined;
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  backTo,
  backLabel = "戻る",
  actions,
}: PageHeaderProps) {
  return (
    <header className="page-header">
      <div className="page-header__content page-header__copy">
        {backTo ? (
          <Link className="page-header__back" to={backTo}>
            <ArrowLeft aria-hidden="true" size={18} />
            <span>{backLabel}</span>
          </Link>
        ) : null}
        {eyebrow ? <p className="page-header__eyebrow">{eyebrow}</p> : null}
        <h1 className="page-header__title" tabIndex={-1}>{title}</h1>
        {description ? (
          <div className="page-header__description">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  );
}

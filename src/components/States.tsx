import type { ReactNode } from "react";
import { CircleAlert, Inbox, LoaderCircle, RotateCw } from "lucide-react";

type StateSize = "page" | "inline";

interface LoadingStateProps {
  message?: string | undefined;
  label?: string | undefined;
  size?: StateSize | undefined;
  className?: string | undefined;
}

interface EmptyStateProps {
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  size?: StateSize | undefined;
  className?: string | undefined;
}

interface ErrorStateProps {
  message?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  title?: string | undefined;
  onRetry?: (() => void) | undefined;
  retryLabel?: string | undefined;
  size?: StateSize | undefined;
  className?: string | undefined;
}

interface FullPageLoadingProps {
  label?: string | undefined;
}

function stateClassName(
  kind: "loading" | "empty" | "error",
  size: StateSize,
  className?: string,
) {
  return [
    "state",
    `state--${kind}`,
    `state--${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export function LoadingState({
  message,
  label,
  size = "page",
  className,
}: LoadingStateProps) {
  return (
    <div
      className={stateClassName("loading", size, className)}
      role="status"
      aria-live="polite"
    >
      <LoaderCircle
        className="state__spinner"
        aria-hidden="true"
        size={size === "page" ? 30 : 20}
      />
      <span>{message ?? label ?? "読み込んでいます…"}</span>
    </div>
  );
}

/** Loading screen used while the app shell itself is not available yet. */
export function FullPageLoading({
  label = "読み込んでいます…",
}: FullPageLoadingProps) {
  return (
    <div className="full-page-state">
      <LoadingState message={label} />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  size = "page",
  className,
}: EmptyStateProps) {
  return (
    <section className={stateClassName("empty", size, className)}>
      <span className="state__icon" aria-hidden="true">
        {icon ?? <Inbox size={size === "page" ? 32 : 22} />}
      </span>
      <h2 className="state__title">{title}</h2>
      {description ? <div className="state__description">{description}</div> : null}
      {action ? <div className="state__action">{action}</div> : null}
    </section>
  );
}

export function ErrorState({
  message,
  description,
  action,
  title = "表示できませんでした",
  onRetry,
  retryLabel = "もう一度試す",
  size = "page",
  className,
}: ErrorStateProps) {
  return (
    <section
      className={stateClassName("error", size, className)}
      role="alert"
    >
      <CircleAlert
        className="state__icon"
        aria-hidden="true"
        size={size === "page" ? 32 : 22}
      />
      <h2 className="state__title">{title}</h2>
      <div className="state__description">
        {message ?? description ?? "少し時間をおいて、もう一度お試しください。"}
      </div>
      {action ? <div className="state__action">{action}</div> : null}
      {onRetry ? (
        <div className="state__action">
          <button className="button button--secondary" type="button" onClick={onRetry}>
            <RotateCw aria-hidden="true" size={17} />
            {retryLabel}
          </button>
        </div>
      ) : null}
    </section>
  );
}

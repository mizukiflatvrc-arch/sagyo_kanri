import { useEffect, useState, type ReactNode } from "react";
import {
  BookOpenText,
  History,
  House,
  LibraryBig,
  LogOut,
  Plus,
  type LucideIcon,
} from "lucide-react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

interface AppShellProps {
  children?: ReactNode;
}

interface NavigationItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
  activeWhen?: (pathname: string) => boolean;
}

const desktopNavigationItems: NavigationItem[] = [
  { to: "/", label: "ホーム", icon: House, end: true },
  { to: "/sessions/new", label: "記録する", icon: Plus, end: true },
  {
    to: "/sessions",
    label: "記録一覧",
    icon: History,
    end: true,
    activeWhen: (pathname) =>
      pathname.startsWith("/sessions") && pathname !== "/sessions/new",
  },
  { to: "/libraries", label: "図書館", icon: LibraryBig },
];

const mobileNavigationItems: NavigationItem[] = [
  { to: "/", label: "ホーム", icon: House, end: true },
  { to: "/sessions", label: "記録一覧", icon: History },
  { to: "/libraries", label: "図書館", icon: LibraryBig },
];

function titleForPath(pathname: string): string {
  if (pathname === "/") return "ホーム";
  if (pathname === "/sessions") return "作業記録";
  if (pathname === "/sessions/new") return "新しい記録";
  if (pathname.endsWith("/edit") && pathname.startsWith("/sessions/")) {
    return "記録を編集";
  }
  if (pathname.endsWith("/next-day")) return "翌日の様子を記録";
  if (pathname.startsWith("/sessions/")) return "記録詳細";
  if (pathname === "/libraries") return "図書館";
  if (pathname === "/libraries/new") return "図書館を登録";
  if (pathname.endsWith("/edit") && pathname.startsWith("/libraries/")) {
    return "図書館を編集";
  }
  return "ページが見つかりません";
}

function NavigationLinks({ items }: { items: NavigationItem[] }) {
  const { pathname } = useLocation();
  return (
    <>
      {items.map(({ to, label, icon: Icon, end, activeWhen }) => (
        <NavLink
          key={to}
          to={to}
          end={end ?? false}
          aria-current={activeWhen?.(pathname) ? "page" : undefined}
          className={({ isActive }) =>
            `app-nav__link nav-link${
              isActive || activeWhen?.(pathname)
                ? " app-nav__link--active active"
                : ""
            }`
          }
        >
          <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </>
  );
}

/**
 * Shared responsive application frame.
 *
 * Desktop navigation lives in the side rail, while the same destinations are
 * repeated in a thumb-friendly bottom navigation on narrow screens.
 */
export function AppShell({ children }: AppShellProps) {
  const { user, signOut, error } = useAuth();
  const { showToast } = useToast();
  const location = useLocation();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const userLabel = user?.displayName ?? user?.email ?? "ログイン中";

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      document.querySelector<HTMLElement>("#main-content")?.focus();
      document.title = `${titleForPath(location.pathname)} | hibi`;
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.pathname]);

  useEffect(() => {
    if (error) showToast(error, "error");
  }, [error, showToast]);

  const handleSignOut = async () => {
    setIsSigningOut(true);
    await signOut();
    setIsSigningOut(false);
  };

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        本文へスキップ
      </a>

      <aside className="app-sidebar sidebar">
        <Link className="app-brand brand" to="/" aria-label="hibi 図書館作業記録 ホーム">
          <span className="app-brand__mark brand-mark" aria-hidden="true">
            <BookOpenText size={24} strokeWidth={1.8} />
          </span>
          <span className="app-brand__text brand-copy">
            <strong className="brand-name">hibi</strong>
            <small className="brand-caption">図書館作業記録</small>
          </span>
        </Link>

        <nav className="app-nav app-nav--desktop primary-nav" aria-label="メインメニュー">
          <NavigationLinks items={desktopNavigationItems} />
        </nav>

        <div className="sidebar-footer">
          <p className="privacy-note">
            記録と振り返りのための個人用ツールです。診断や復学可否の判定は行いません。
          </p>
          <div className="app-sidebar__account account-row">
          {user?.photoURL ? (
            <img
              className="user-avatar account-avatar"
              src={user.photoURL}
              alt=""
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="user-avatar user-avatar--fallback account-avatar" aria-hidden="true">
              {userLabel.slice(0, 1)}
            </span>
          )}
          <span className="app-sidebar__user account-copy" title={userLabel}>
            <span className="account-name">{userLabel}</span>
            {user?.email && <span className="account-email">{user.email}</span>}
          </span>
          <button
            className="icon-button"
            type="button"
            onClick={() => void handleSignOut()}
            disabled={isSigningOut}
            aria-label="ログアウト"
            title="ログアウト"
          >
            <LogOut aria-hidden="true" size={19} />
          </button>
          </div>
        </div>
      </aside>

      <header className="app-mobile-header">
        <Link className="app-brand app-brand--mobile" to="/">
          <BookOpenText aria-hidden="true" size={22} strokeWidth={1.8} />
          <span>図書館作業記録</span>
        </Link>
        <button
          className="icon-button"
          type="button"
          onClick={() => void handleSignOut()}
          disabled={isSigningOut}
          aria-label="ログアウト"
          title="ログアウト"
        >
          <LogOut aria-hidden="true" size={19} />
        </button>
      </header>

      <main className="app-main main-column" id="main-content" tabIndex={-1}>
        <div className="app-main__inner">
          {children === undefined ? <Outlet /> : children}
        </div>
      </main>

      <nav className="app-nav app-nav--mobile mobile-nav" aria-label="モバイルメニュー">
        <NavigationLinks items={mobileNavigationItems} />
      </nav>
    </div>
  );
}

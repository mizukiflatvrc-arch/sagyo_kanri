import { BookOpenText, LogOut, ShieldX } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function UnauthorizedPage() {
  const { user, signOut, error } = useAuth();

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-labelledby="unauthorized-heading">
        <div className="auth-visual">
          <div className="auth-brand">
            <span className="brand-mark" aria-hidden="true">
              <BookOpenText size={21} />
            </span>
            <span className="brand-copy">
              <span className="brand-name">hibi</span>
              <span className="brand-caption">図書館作業記録</span>
            </span>
          </div>
          <div className="auth-quote">
            <h1>記録は、本人だけの場所に。</h1>
            <p>ログインに成功しましたが、このアカウントには利用権限がありません。</p>
          </div>
        </div>
        <div className="auth-panel">
          <p className="auth-panel__eyebrow">ACCESS LIMITED</p>
          <ShieldX size={38} aria-hidden="true" />
          <h2 id="unauthorized-heading">このアカウントでは利用できません</h2>
          <p>
            {user?.email ? `${user.email} でログインしています。` : "許可されたアカウントでログインし直してください。"}
          </p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button type="button" className="button button--secondary button--full" onClick={signOut}>
            <LogOut size={18} />
            ログアウトして戻る
          </button>
        </div>
      </section>
    </main>
  );
}

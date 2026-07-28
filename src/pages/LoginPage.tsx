import { useState } from "react";
import { BookOpenText, Info, LockKeyhole } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function LoginPage() {
  const { signIn, error } = useAuth();
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    await signIn();
    setIsSigningIn(false);
  };

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-labelledby="login-heading">
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
            <h1>今日の時間を、静かに記しておく。</h1>
            <p>
              図書館での作業と、その日の状態。あとから自分のペースを振り返るための記録帳です。
            </p>
          </div>
        </div>

        <div className="auth-panel">
          <p className="auth-panel__eyebrow">PRIVATE ACCESS</p>
          <h2 id="login-heading">記録をひらく</h2>
          <p>
            Googleアカウントでログインすると、すぐに自分専用の記録を始められます。
          </p>
          {error && (
            <div className="auth-error" role="alert">
              {error}
            </div>
          )}
          <button
            type="button"
            className="button button--primary button--full"
            onClick={() => void handleSignIn()}
            disabled={isSigningIn}
          >
            <LockKeyhole size={18} />
            {isSigningIn ? "ログイン中…" : "Googleでログイン"}
          </button>
          <div className="auth-disclaimer">
            <Info size={16} aria-hidden="true" />
            <span>
              このアプリは記録と振り返りを補助するもので、医療的な診断や復学可否を判定するものではありません。
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

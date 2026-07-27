import { BookOpenText, Settings2, ShieldCheck } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export function SetupRequiredPage() {
  const { configurationMessage } = useAuth();

  return (
    <main className="auth-page">
      <section className="auth-layout" aria-labelledby="setup-heading">
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
            <h1>最初に、記録の置き場所を整えます。</h1>
            <p>Firebaseの接続情報は、コードに含めず環境変数から読み込みます。</p>
          </div>
        </div>
        <div className="auth-panel">
          <p className="auth-panel__eyebrow">FIRST SETUP</p>
          <h2 id="setup-heading">Firebaseの設定が必要です</h2>
          <p>
            <code>.env.example</code> を <code>.env.local</code> にコピーし、Firebaseコンソールの値と許可UIDを入力してください。
          </p>
          <div className="auth-error" role="status">
            <Settings2 size={16} aria-hidden="true" /> {configurationMessage}
          </div>
          <div className="auth-disclaimer">
            <ShieldCheck size={17} aria-hidden="true" />
            <span>
              Firestore Rules内の <code>REPLACE_WITH_ALLOWED_UID</code> も同じUIDへ置き換えてからデプロイします。詳しい手順はREADMEにあります。
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}

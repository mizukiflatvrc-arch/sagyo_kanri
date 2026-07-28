import { KeyRound, LogOut, RotateCw } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { useEncryption } from "../contexts/EncryptionContext";

export function EncryptionUnavailablePage() {
  const { signOut } = useAuth();
  const { retry } = useEncryption();

  return (
    <main className="auth-page">
      <section className="auth-panel card card--padded encryption-error-panel">
        <KeyRound aria-hidden="true" size={34} />
        <h1>暗号鍵を準備できませんでした</h1>
        <p>
          通信状態を確認して、もう一度お試しください。自由記述を安全に扱えないため、鍵を取得するまで記録は表示しません。
        </p>
        <button className="button button--primary button--full" type="button" onClick={retry}>
          <RotateCw size={17} />
          再試行
        </button>
        <button
          className="button button--ghost button--full"
          type="button"
          onClick={() => void signOut()}
        >
          <LogOut size={17} />
          ログアウト
        </button>
      </section>
    </main>
  );
}

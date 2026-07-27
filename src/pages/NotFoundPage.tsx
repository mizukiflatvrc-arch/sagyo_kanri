import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { EmptyState } from "../components/States";

export function NotFoundPage() {
  return (
    <div className="page page--narrow">
      <EmptyState
        icon={<Compass size={25} />}
        title="ページが見つかりません"
        description="URLをご確認いただくか、ホームへ戻ってください。"
        action={
          <Link className="button button--primary" to="/">
            ホームへ戻る
          </Link>
        }
      />
    </div>
  );
}

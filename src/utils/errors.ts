const FALLBACK_MESSAGE = "処理を完了できませんでした。少し時間をおいて、もう一度お試しください。";

const FRIENDLY_FIREBASE_MESSAGES: Record<string, string> = {
  "auth/popup-closed-by-user": "ログイン画面が閉じられました。",
  "auth/popup-blocked": "ログイン画面を開けませんでした。ポップアップの設定をご確認ください。",
  "auth/network-request-failed": "ネットワークに接続できませんでした。",
  "permission-denied": "この操作を行う権限がありません。",
  unavailable: "現在サービスに接続できません。少し時間をおいてお試しください。",
};

export function toUserMessage(error: unknown): string {
  if (error instanceof Error && error.name === "ConcurrentEditError") {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "code" in error) {
    const rawCode = String(error.code);
    const code = rawCode.includes("/") ? rawCode.split("/").at(-1) ?? rawCode : rawCode;
    return FRIENDLY_FIREBASE_MESSAGES[rawCode] ?? FRIENDLY_FIREBASE_MESSAGES[code] ?? FALLBACK_MESSAGE;
  }

  return error instanceof Error && error.message === "Firebaseの設定が完了していません。"
    ? error.message
    : FALLBACK_MESSAGE;
}

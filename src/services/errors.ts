export class ConcurrentEditError extends Error {
  constructor() {
    super(
      "別の画面でこの記録が更新されました。入力内容を控えてから、ページを開き直してください。",
    );
    this.name = "ConcurrentEditError";
  }
}

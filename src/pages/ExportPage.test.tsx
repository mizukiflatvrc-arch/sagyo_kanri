import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportSessionRecord } from "../utils/export";

const { getSessionsForExportMock } = vi.hoisted(() => ({
  getSessionsForExportMock: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({ user: { uid: "export-user" } }),
}));

vi.mock("../services/sessions", () => ({
  getSessionsForExport: getSessionsForExportMock,
}));

import { ExportPage } from "./ExportPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const RECORD: ExportSessionRecord = {
  enteredAt: new Date("2026-07-28T01:15:00.000Z"),
  exitedAt: new Date("2026-07-28T03:30:00.000Z"),
  stayMinutes: 135,
  actualWorkMinutes: 100,
  concentrationScore: 7,
  anxietyScore: 4,
  fatigueScore: 6,
  selfCriticismMinutes: 20,
};

function buttonByText(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

describe("ExportPage", () => {
  let root: Root;
  let container: HTMLDivElement;
  let originalClipboard: PropertyDescriptor | undefined;

  beforeEach(() => {
    getSessionsForExportMock.mockReset();
    originalClipboard = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    act(() => root.render(<ExportPage />));
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    if (originalClipboard) {
      Object.defineProperty(navigator, "clipboard", originalClipboard);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
    vi.restoreAllMocks();
  });

  it("未生成時はコピーと印刷を無効にし、取得中も生成ボタンを無効にする", async () => {
    let resolveRequest: ((records: ExportSessionRecord[]) => void) | undefined;
    getSessionsForExportMock.mockReturnValueOnce(
      new Promise<ExportSessionRecord[]>((resolve) => {
        resolveRequest = resolve;
      }),
    );

    expect(buttonByText(container, "Markdownをコピー").disabled).toBe(true);
    expect(buttonByText(container, "印刷・PDF保存").disabled).toBe(true);

    act(() => buttonByText(container, "プレビューを生成").click());
    expect(buttonByText(container, "生成しています").disabled).toBe(true);

    await act(async () => {
      resolveRequest?.([RECORD]);
      await Promise.resolve();
    });
  });

  it("0件の場合も期間内の日付を表として表示する", async () => {
    getSessionsForExportMock.mockResolvedValueOnce([]);

    await act(async () => {
      buttonByText(container, "プレビューを生成").click();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("対象件数: 0件");
    expect(container.textContent).toContain("指定した期間に記録はありません");
    expect(container.querySelector(".export-data-table--preview")).not.toBeNull();
    expect(container.textContent).toContain("---");
    expect(buttonByText(container, "Markdownをコピー").disabled).toBe(false);
    expect(buttonByText(container, "印刷・PDF保存").disabled).toBe(false);
  });

  it("Markdown記法ではなく整形済みの表をプレビューする", async () => {
    getSessionsForExportMock.mockResolvedValueOnce([RECORD]);

    await act(async () => {
      buttonByText(container, "プレビューを生成").click();
      await Promise.resolve();
    });

    const table = container.querySelector<HTMLTableElement>(
      ".export-data-table--preview",
    );
    expect(table).not.toBeNull();
    expect(table?.querySelector("th")?.textContent).toBe("作業日");
    expect(table?.textContent).toContain("07/28");
    expect(table?.textContent).toContain("10:15");
    expect(container.querySelector(".export-copy-fallback")).toBeNull();
  });

  it("コピー成功を表示する", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    getSessionsForExportMock.mockResolvedValueOnce([RECORD]);

    await act(async () => {
      buttonByText(container, "プレビューを生成").click();
      await Promise.resolve();
    });
    await act(async () => {
      buttonByText(container, "Markdownをコピー").click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain("| 作業日 | 入室時刻 |");
    expect(container.textContent).toContain("Markdownをコピーしました");
  });

  it("コピー失敗時はプレビューを選択して手動コピーを案内する", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: vi.fn().mockRejectedValue(new Error("permission denied")),
      },
    });
    getSessionsForExportMock.mockResolvedValueOnce([RECORD]);

    await act(async () => {
      buttonByText(container, "プレビューを生成").click();
      await Promise.resolve();
    });
    const select = vi.spyOn(HTMLTextAreaElement.prototype, "select");

    await act(async () => {
      buttonByText(container, "Markdownをコピー").click();
      await Promise.resolve();
    });

    expect(select).toHaveBeenCalledOnce();
    expect(container.querySelector(".export-copy-fallback textarea")).not.toBeNull();
    expect(container.textContent).toContain(
      "表示されたMarkdownを手動でコピーしてください",
    );
  });
});

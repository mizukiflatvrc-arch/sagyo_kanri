import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportSessionRecord } from "../report/types";

const mocks = vi.hoisted(() => ({
  getSessionsForReport: vi.fn(),
  createReportPdfBlob: vi.fn(),
  downloadPdfBlob: vi.fn(),
  reportPdfFilename: vi.fn(),
  getIdToken: vi.fn(),
}));

vi.mock("../contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "export-user", getIdToken: mocks.getIdToken },
  }),
}));

vi.mock("../contexts/DataContext", () => ({
  useData: () => ({
    libraryById: new Map([
      ["central", { id: "central", name: "中央図書館" }],
    ]),
  }),
}));

vi.mock("../services/sessions", () => ({
  getSessionsForReport: mocks.getSessionsForReport,
}));

vi.mock("../report/pdf", () => ({
  createReportPdfBlob: mocks.createReportPdfBlob,
  downloadPdfBlob: mocks.downloadPdfBlob,
  reportPdfFilename: mocks.reportPdfFilename,
}));

import { ExportPage } from "./ExportPage";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const RECORD: ReportSessionRecord = {
  libraryId: "central",
  enteredAt: new Date("2026-09-06T01:15:00.000Z"),
  exitedAt: new Date("2026-09-06T03:30:00.000Z"),
  stayMinutes: 135,
  concentrationScore: 7,
  anxietyScore: 4,
  fatigueScore: 6,
  selfCriticismScore: 3,
  actualTaskText: "レポートを実装した。",
  note: "安定していた。",
};

function buttonByText(container: HTMLElement, text: string) {
  const button = [...container.querySelectorAll("button")].find((candidate) =>
    candidate.textContent?.includes(text),
  );
  if (!button) throw new Error(`Button not found: ${text}`);
  return button;
}

async function click(container: HTMLElement, text: string) {
  await act(async () => {
    buttonByText(container, text).click();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function generateWithoutLlm(container: HTMLElement) {
  const llm = container.querySelector<HTMLInputElement>("#report-llm-summary");
  if (!llm) throw new Error("LLM switch not found");
  act(() => llm.click());
  await click(container, "PDF生成へ");
  await click(container, "この内容で生成");
}

describe("ExportPage", () => {
  let root: Root;
  let container: HTMLDivElement;
  let originalClipboard: PropertyDescriptor | undefined;
  let originalCreateObjectUrl: typeof URL.createObjectURL | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-07T13:36:00.000Z"));
    Object.values(mocks).forEach((mock) => mock.mockReset());
    mocks.getSessionsForReport.mockResolvedValue([RECORD]);
    mocks.createReportPdfBlob.mockResolvedValue(
      new Blob(["pdf"], { type: "application/pdf" }),
    );
    mocks.reportPdfFilename.mockReturnValue(
      "hibi_report_2026-09-01_2026-09-07.pdf",
    );
    mocks.getIdToken.mockResolvedValue("token");
    originalClipboard = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    originalCreateObjectUrl = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:report-preview");
    URL.revokeObjectURL = vi.fn();
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
    if (originalCreateObjectUrl) URL.createObjectURL = originalCreateObjectUrl;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("診察向けの既定値を設定し、生成前に対象と比較期間を確認する", async () => {
    expect(container.querySelector<HTMLInputElement>("#report-target-date")?.value)
      .toBe("2026-09-07");
    expect(container.querySelector<HTMLInputElement>("#report-duration-days")?.value)
      .toBe("7");
    expect(container.querySelector<HTMLSelectElement>("#report-orientation")?.value)
      .toBe("landscape");
    expect(container.querySelector<HTMLInputElement>("#report-llm-summary")?.checked)
      .toBe(true);
    expect(container.querySelector<HTMLInputElement>("#report-library-comparison")?.checked)
      .toBe(false);
    expect(container.querySelector<HTMLInputElement>("#report-pdf-preview")?.checked)
      .toBe(false);

    await click(container, "PDF生成へ");

    expect(mocks.getSessionsForReport).not.toHaveBeenCalled();
    const dialog = container.querySelector(".report-confirmation-list");
    expect(dialog?.textContent).toContain("図書館作業レポート");
    expect(dialog?.textContent).toContain("2026/9/1〜2026/9/7");
    expect(dialog?.textContent).toContain("2026/8/25〜2026/8/31");
    expect(dialog?.textContent).toContain("A4横");
  });

  it("LLM OFFでは一度も要約を呼ばず、直接PDFを生成してMarkdownも維持する", async () => {
    await generateWithoutLlm(container);

    expect(mocks.getSessionsForReport).toHaveBeenCalledOnce();
    const [, start, endExclusive] = mocks.getSessionsForReport.mock.calls[0]!;
    expect(start.toISOString()).toBe("2026-08-24T15:00:00.000Z");
    expect(endExclusive.toISOString()).toBe("2026-09-07T15:00:00.000Z");
    expect(mocks.getIdToken).not.toHaveBeenCalled();
    expect(mocks.createReportPdfBlob).toHaveBeenCalledOnce();
    expect(mocks.createReportPdfBlob.mock.calls[0]?.[1]).toMatchObject({
      orientation: "landscape",
      includeLibraryComparison: false,
      summary: null,
    });
    expect(mocks.downloadPdfBlob).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("対象件数: 1件");
    expect(container.textContent).toContain("09/06");
  });

  it("0件でも期間内の全日をMarkdownへ残しPDFを生成する", async () => {
    mocks.getSessionsForReport.mockResolvedValueOnce([]);
    await generateWithoutLlm(container);

    expect(container.textContent).toContain("対象件数: 0件");
    expect(container.textContent).toContain("対象期間に記録はありません");
    expect(container.querySelector(".export-data-table--preview")).not.toBeNull();
    expect(container.textContent).toContain("---");
    expect(mocks.createReportPdfBlob).toHaveBeenCalledOnce();
  });

  it("LLM未設定時はダイアログ通知後、要約なしで生成を続ける", async () => {
    await click(container, "PDF生成へ");
    await click(container, "この内容で生成");

    expect(container.textContent).toContain("LLM要約の生成に失敗しました");
    expect(mocks.createReportPdfBlob).not.toHaveBeenCalled();

    await click(container, "要約なしで続ける");

    expect(mocks.createReportPdfBlob).toHaveBeenCalledOnce();
    expect(mocks.createReportPdfBlob.mock.calls[0]?.[1]).toMatchObject({
      summary: null,
    });
    expect(mocks.downloadPdfBlob).toHaveBeenCalledOnce();
  });

  it("プレビューONでは完成PDFを埋め込み、保存操作まで自動ダウンロードしない", async () => {
    act(() =>
      container.querySelector<HTMLInputElement>("#report-llm-summary")?.click(),
    );
    act(() =>
      container.querySelector<HTMLInputElement>("#report-pdf-preview")?.click(),
    );
    await click(container, "PDF生成へ");
    await click(container, "この内容で生成");

    expect(container.querySelector<HTMLIFrameElement>("iframe")?.src)
      .toContain("blob:report-preview");
    expect(mocks.downloadPdfBlob).not.toHaveBeenCalled();

    await click(container, "PDFを保存");
    expect(mocks.downloadPdfBlob).toHaveBeenCalledOnce();
  });

  it("生成後も既存Markdownをコピーできる", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    await generateWithoutLlm(container);
    await click(container, "Markdownをコピー");

    expect(writeText).toHaveBeenCalledOnce();
    expect(writeText.mock.calls[0]?.[0]).toContain("| 作業日 | 入室時刻 |");
    expect(container.textContent).toContain("Markdownをコピーしました");
  });
});

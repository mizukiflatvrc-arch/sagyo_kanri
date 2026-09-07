import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Copy, Download, FileDown, RotateCw, X } from "lucide-react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { NoticeDialog } from "../components/NoticeDialog";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import { useData } from "../contexts/DataContext";
import {
  REPORT_TITLE,
  type ReportData,
  type ReportOrientation,
  type ReportPeriods,
  type ReportSessionRecord,
  type ReportSummary,
} from "../report/types";
import {
  createConfiguredReportSummarizer,
  createReportSummaryInput,
} from "../report/summarizer";
import { getSessionsForReport } from "../services/sessions";
import {
  createJstDateRange,
  formatJstDateTime,
  toJstDateKey,
} from "../utils/date";
import {
  EXPORT_TABLE_HEADERS,
  createExportTableRows,
  generateSessionsMarkdown,
  type ExportTableRow,
} from "../utils/export";
import { toUserMessage } from "../utils/errors";
import {
  calculateReportPeriods,
  createReportData,
  formatReportDateLong,
} from "../utils/report";

interface GeneratedExport {
  startDate: string;
  endDate: string;
  generatedAt: Date;
  sessions: ReportSessionRecord[];
  rows: ExportTableRow[];
  markdown: string;
}

interface ReportRequest {
  periods: ReportPeriods;
  orientation: ReportOrientation;
  includeLibraryComparison: boolean;
  includeLlmSummary: boolean;
  previewPdf: boolean;
}

interface PreparedReport {
  report: ReportData;
  request: ReportRequest;
  generatedAt: Date;
}

interface PdfPreview {
  blob: Blob;
  url: string;
  filename: string;
}

function initialDateValues(now = new Date()) {
  return {
    targetDate: toJstDateKey(now),
    durationDays: "7",
  };
}

function periodText(period: { startDate: string; endDate: string }): string {
  return `${formatReportDateLong(period.startDate)}〜${formatReportDateLong(period.endDate)}`;
}

function onOff(value: boolean): string {
  return value ? "ON" : "OFF";
}

function sessionsInPeriod(
  sessions: readonly ReportSessionRecord[],
  period: { startDate: string; endDate: string },
): ReportSessionRecord[] {
  return sessions.filter((session) => {
    const date = toJstDateKey(session.enteredAt);
    return date >= period.startDate && date <= period.endDate;
  });
}

export function ExportPage() {
  const { user } = useAuth();
  const { libraryById } = useData();
  const initialDates = useMemo(() => initialDateValues(), []);
  const [targetDate, setTargetDate] = useState(initialDates.targetDate);
  const [durationDays, setDurationDays] = useState(initialDates.durationDays);
  const [orientation, setOrientation] =
    useState<ReportOrientation>("landscape");
  const [includeLibraryComparison, setIncludeLibraryComparison] =
    useState(false);
  const [includeLlmSummary, setIncludeLlmSummary] = useState(true);
  const [previewPdf, setPreviewPdf] = useState(false);
  const [dateError, setDateError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [pdfMessage, setPdfMessage] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedExport | null>(null);
  const [pendingRequest, setPendingRequest] = useState<ReportRequest | null>(
    null,
  );
  const [fallbackReport, setFallbackReport] =
    useState<PreparedReport | null>(null);
  const [pdfPreview, setPdfPreview] = useState<PdfPreview | null>(null);
  const copyFallbackRef = useRef<HTMLTextAreaElement>(null);
  const copyMessageTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (copyMessageTimer.current !== null) {
        window.clearTimeout(copyMessageTimer.current);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (pdfPreview) URL.revokeObjectURL(pdfPreview.url);
    },
    [pdfPreview],
  );

  useEffect(() => {
    if (!copyFailed) return;
    copyFallbackRef.current?.focus();
    copyFallbackRef.current?.select();
  }, [copyFailed]);

  const clearGeneratedOutput = () => {
    setGenerated(null);
    setPdfPreview(null);
    setFetchError("");
    setCopyMessage("");
    setPdfMessage("");
    setCopyFailed(false);
  };

  const clearPdfOutput = () => {
    setPdfPreview(null);
    setFetchError("");
    setPdfMessage("");
  };

  const updateTargetDate = (value: string) => {
    setTargetDate(value);
    setDateError("");
    clearGeneratedOutput();
  };

  const updateDurationDays = (value: string) => {
    setDurationDays(value);
    setDateError("");
    clearGeneratedOutput();
  };

  const openConfirmation = (event: FormEvent) => {
    event.preventDefault();
    setDateError("");
    setFetchError("");
    setPdfMessage("");

    if (targetDate === "") {
      setDateError("対象日を入力してください。");
      return;
    }
    const days = Number(durationDays);
    const periods = calculateReportPeriods(targetDate, days);
    if (periods === null) {
      setDateError("期間は1以上の整数で入力してください。");
      return;
    }
    setPendingRequest({
      periods,
      orientation,
      includeLibraryComparison,
      includeLlmSummary,
      previewPdf,
    });
  };

  async function outputPdf(
    prepared: PreparedReport,
    summary: ReportSummary | null,
  ) {
    const { createReportPdfBlob, downloadPdfBlob, reportPdfFilename } =
      await import("../report/pdf");
    const blob = await createReportPdfBlob(prepared.report, {
      orientation: prepared.request.orientation,
      includeLibraryComparison:
        prepared.request.includeLibraryComparison,
      generatedAt: prepared.generatedAt,
      summary,
    });
    const filename = reportPdfFilename(prepared.report);
    setPdfPreview(null);
    if (prepared.request.previewPdf) {
      setPdfPreview({ blob, filename, url: URL.createObjectURL(blob) });
      setPdfMessage("PDFを生成しました。内容を確認して保存できます。");
    } else {
      downloadPdfBlob(blob, filename);
      setPdfMessage(`PDFを生成しました（${filename}）。`);
    }
  }

  const generateConfirmedReport = async () => {
    const request = pendingRequest;
    if (!request || !user) {
      setFetchError(
        "ログイン状態を確認できませんでした。再度ログインしてください。",
      );
      return;
    }
    const range = createJstDateRange(
      request.periods.comparison.startDate,
      request.periods.target.endDate,
    );
    if (range === null) {
      setDateError("日付を正しく入力してください。");
      setPendingRequest(null);
      return;
    }

    setIsLoading(true);
    setFetchError("");
    setPdfMessage("");
    try {
      const sessions = await getSessionsForReport(
        user.uid,
        range.start,
        range.endExclusive,
      );
      const libraryNames = new Map(
        [...libraryById].map(([id, library]) => [id, library.name]),
      );
      const report = createReportData(sessions, request.periods, libraryNames);
      const generatedAt = new Date();
      const targetSessions = sessionsInPeriod(sessions, request.periods.target);
      const markdownPeriod = {
        startDate: request.periods.target.startDate,
        endDate: request.periods.target.endDate,
      };
      setGenerated({
        ...markdownPeriod,
        generatedAt,
        sessions: targetSessions,
        rows: createExportTableRows(targetSessions, markdownPeriod),
        markdown: generateSessionsMarkdown(targetSessions, markdownPeriod),
      });
      const prepared = { report, request, generatedAt };

      let summary: ReportSummary | null = null;
      if (request.includeLlmSummary) {
        try {
          const unauthedSummarizer = createConfiguredReportSummarizer();
          if (!unauthedSummarizer) {
            throw new Error("要約サービスが設定されていません。");
          }
          const accessToken = await user.getIdToken();
          const summarizer =
            createConfiguredReportSummarizer(accessToken) ?? unauthedSummarizer;
          summary = await summarizer.summarize(
            createReportSummaryInput(
              report,
              request.includeLibraryComparison,
            ),
          );
        } catch {
          setPendingRequest(null);
          setFallbackReport(prepared);
          return;
        }
      }

      await outputPdf(prepared, summary);
      setPendingRequest(null);
    } catch (error) {
      setPendingRequest(null);
      setFetchError(toUserMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const continueWithoutSummary = async () => {
    const prepared = fallbackReport;
    setFallbackReport(null);
    if (!prepared) return;
    setIsLoading(true);
    try {
      await outputPdf(prepared, null);
    } catch (error) {
      setFetchError(toUserMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  const retryGeneration = () => {
    const periods = calculateReportPeriods(targetDate, Number(durationDays));
    if (!periods) return;
    setPendingRequest({
      periods,
      orientation,
      includeLibraryComparison,
      includeLlmSummary,
      previewPdf,
    });
  };

  const handleCopy = async () => {
    if (!generated?.markdown) return;
    if (copyMessageTimer.current !== null) {
      window.clearTimeout(copyMessageTimer.current);
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard API is unavailable");
      }
      await navigator.clipboard.writeText(generated.markdown);
      setCopyFailed(false);
      setCopyMessage("Markdownをコピーしました");
      copyMessageTimer.current = window.setTimeout(() => {
        setCopyMessage("");
        copyMessageTimer.current = null;
      }, 4_500);
    } catch {
      setCopyFailed(true);
      setCopyMessage(
        "コピーできませんでした。表示されたMarkdownを手動でコピーしてください。",
      );
    }
  };

  const canCopy = Boolean(generated?.markdown);
  const targetCount = generated ? `${generated.sessions.length}件` : "未生成";

  return (
    <div className="page export-page">
      <PageHeader
        eyebrow="EXPORT"
        title="記録をエクスポート"
        description="診察時に見せやすい図書館作業レポートをPDFで作成します。既存のMarkdownコピーも利用できます。"
      />

      <section className="card card--padded export-controls">
        <form
          className="report-settings-form"
          onSubmit={openConfirmation}
          noValidate
        >
          <div className="report-period-settings">
            <div className="field">
              <label htmlFor="report-target-date">対象日</label>
              <input
                className="input"
                id="report-target-date"
                type="date"
                value={targetDate}
                aria-describedby={dateError ? "export-date-error" : undefined}
                aria-invalid={dateError ? "true" : undefined}
                disabled={isLoading}
                onChange={(event) => updateTargetDate(event.target.value)}
              />
              <span className="field-hint">この日を期間の最終日にします</span>
            </div>
            <div className="field">
              <label htmlFor="report-duration-days">期間（日数）</label>
              <input
                className="input"
                id="report-duration-days"
                type="number"
                inputMode="numeric"
                min="1"
                step="1"
                value={durationDays}
                aria-describedby={dateError ? "export-date-error" : undefined}
                aria-invalid={dateError ? "true" : undefined}
                disabled={isLoading}
                onChange={(event) => updateDurationDays(event.target.value)}
              />
              <div className="report-presets" aria-label="期間プリセット">
                {[7, 14, 30].map((days) => (
                  <button
                    className="button button--secondary button--small"
                    type="button"
                    key={days}
                    disabled={isLoading}
                    onClick={() => updateDurationDays(String(days))}
                  >
                    直近{days}日
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label htmlFor="report-orientation">用紙の向き</label>
              <select
                className="input"
                id="report-orientation"
                value={orientation}
                disabled={isLoading}
                onChange={(event) => {
                  setOrientation(event.target.value as ReportOrientation);
                  clearPdfOutput();
                }}
              >
                <option value="landscape">A4横</option>
                <option value="portrait">A4縦</option>
              </select>
            </div>
          </div>

          <fieldset className="report-options">
            <legend>PDFに含める内容</legend>
            <ReportOptionSwitch
              id="report-llm-summary"
              label="LLM要約"
              checked={includeLlmSummary}
              disabled={isLoading}
              onChange={(checked) => {
                setIncludeLlmSummary(checked);
                clearPdfOutput();
              }}
            />
            <ReportOptionSwitch
              id="report-library-comparison"
              label="図書館ごとの比較を含める"
              checked={includeLibraryComparison}
              disabled={isLoading}
              onChange={(checked) => {
                setIncludeLibraryComparison(checked);
                clearPdfOutput();
              }}
            />
            <ReportOptionSwitch
              id="report-pdf-preview"
              label="PDFプレビュー"
              checked={previewPdf}
              disabled={isLoading}
              onChange={(checked) => {
                setPreviewPdf(checked);
                clearPdfOutput();
              }}
            />
          </fieldset>

          {dateError ? (
            <p
              className="field-error export-date-error"
              id="export-date-error"
              role="alert"
            >
              {dateError}
            </p>
          ) : null}

          <div className="report-submit-row">
            <p>比較期間は、対象期間の直前にある同じ日数で自動計算します。</p>
            <button
              className="button button--primary report-generate-button"
              type="submit"
              disabled={isLoading}
            >
              <FileDown aria-hidden="true" size={18} />
              {isLoading ? "生成しています…" : "PDF生成へ"}
            </button>
          </div>
        </form>
      </section>

      {isLoading ? (
        <LoadingState
          className="card card--flat export-loading"
          message="記録を集計してPDFを生成しています…"
          size="inline"
        />
      ) : fetchError ? (
        <div className="card card--flat export-inline-error" role="alert">
          <p>レポートを生成できませんでした。{fetchError}</p>
          <button
            className="button button--secondary button--small"
            type="button"
            onClick={retryGeneration}
          >
            <RotateCw aria-hidden="true" size={16} />
            もう一度試す
          </button>
        </div>
      ) : pdfMessage ? (
        <p className="report-pdf-status" role="status">
          {pdfMessage}
        </p>
      ) : null}

      {pdfPreview ? (
        <section className="report-pdf-preview" aria-labelledby="pdf-preview-title">
          <div className="section-heading report-pdf-preview__heading">
            <div>
              <h2 id="pdf-preview-title">完成PDFプレビュー</h2>
              <p>閲覧専用です。内容を確認して保存してください。</p>
            </div>
            <div className="action-row">
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  void import("../report/pdf").then(({ downloadPdfBlob }) =>
                    downloadPdfBlob(pdfPreview.blob, pdfPreview.filename),
                  );
                }}
              >
                <Download aria-hidden="true" size={17} />
                PDFを保存
              </button>
              <button
                className="button button--secondary"
                type="button"
                onClick={() => setPdfPreview(null)}
              >
                <X aria-hidden="true" size={17} />
                閉じる
              </button>
            </div>
          </div>
          <div className="report-pdf-preview__frame">
            <iframe src={pdfPreview.url} title="図書館作業レポートPDF" />
          </div>
        </section>
      ) : null}

      <section className="export-result" aria-labelledby="export-preview-title">
        <div className="section-heading export-result__heading">
          <div>
            <h2 id="export-preview-title">Markdownエクスポート</h2>
            <p aria-live="polite">対象件数: {targetCount}</p>
          </div>
          <button
            className="button button--secondary"
            type="button"
            disabled={!canCopy || isLoading}
            onClick={() => void handleCopy()}
          >
            <Copy aria-hidden="true" size={17} />
            Markdownをコピー
          </button>
        </div>

        {copyMessage ? (
          <p
            className={
              copyMessage.startsWith("Markdown")
                ? "copy-status"
                : "field-error"
            }
            role={copyMessage.startsWith("Markdown") ? "status" : "alert"}
          >
            {copyMessage}
          </p>
        ) : null}

        {generated ? (
          <>
            {generated.sessions.length === 0 ? (
              <p className="export-no-records" role="status">
                対象期間に記録はありません。未登録の日は「---」で表示しています。
              </p>
            ) : null}
            <div
              className="export-table-preview"
              role="region"
              aria-label="Markdown表のプレビュー"
              tabIndex={0}
            >
              <ExportDataTable
                className="export-data-table export-data-table--preview"
                rows={generated.rows}
              />
            </div>
            <p className="export-generated-at">
              集計日時: {formatJstDateTime(generated.generatedAt)}
            </p>
            {copyFailed ? (
              <div className="export-copy-fallback">
                <label htmlFor="export-copy-fallback">
                  手動コピー用Markdown
                </label>
                <textarea
                  ref={copyFallbackRef}
                  id="export-copy-fallback"
                  value={generated.markdown}
                  readOnly
                  spellCheck={false}
                  wrap="off"
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="card card--flat export-empty">
            PDF生成時に、対象期間のMarkdown表もここへ用意します。
          </div>
        )}
      </section>

      <ConfirmDialog
        open={pendingRequest !== null}
        title="PDFの生成内容を確認"
        description={
          pendingRequest ? <ReportConfirmation request={pendingRequest} /> : null
        }
        confirmLabel="この内容で生成"
        pendingLabel="生成しています…"
        isPending={isLoading}
        tone="primary"
        onConfirm={() => void generateConfirmedReport()}
        onClose={() => {
          if (!isLoading) setPendingRequest(null);
        }}
      />

      <NoticeDialog
        open={fallbackReport !== null}
        title="LLM要約の生成に失敗しました"
        description={
          <p>
            要約なしでPDFを生成します。日別の文章は各セッションの原文を時系列順に連結します。
          </p>
        }
        closeLabel="要約なしで続ける"
        onClose={() => void continueWithoutSummary()}
      />
    </div>
  );
}

function ReportOptionSwitch({
  id,
  label,
  checked,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="report-option-row">
      <span>{label}</span>
      <label className="switch" htmlFor={id}>
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.target.checked)}
        />
        <span className="switch-track" aria-hidden="true" />
      </label>
      <span className="report-option-state">{onOff(checked)}</span>
    </div>
  );
}

function ReportConfirmation({ request }: { request: ReportRequest }) {
  return (
    <dl className="report-confirmation-list">
      <div>
        <dt>タイトル</dt>
        <dd>{REPORT_TITLE}</dd>
      </div>
      <div>
        <dt>対象期間</dt>
        <dd>{periodText(request.periods.target)}</dd>
      </div>
      <div>
        <dt>比較期間</dt>
        <dd>{periodText(request.periods.comparison)}</dd>
      </div>
      <div>
        <dt>用紙</dt>
        <dd>{request.orientation === "landscape" ? "A4横" : "A4縦"}</dd>
      </div>
      <div>
        <dt>図書館比較</dt>
        <dd>{onOff(request.includeLibraryComparison)}</dd>
      </div>
      <div>
        <dt>LLM要約</dt>
        <dd>{onOff(request.includeLlmSummary)}</dd>
      </div>
      <div>
        <dt>プレビュー</dt>
        <dd>{onOff(request.previewPdf)}</dd>
      </div>
    </dl>
  );
}

function ExportDataTable({
  className,
  rows,
}: {
  className: string;
  rows: ExportTableRow[];
}) {
  return (
    <table className={className}>
      <thead>
        <tr>
          {EXPORT_TABLE_HEADERS.map((header) => (
            <th key={header} scope="col">
              {header}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={`${row.workDate}-${row.enteredTime}-${index}`}>
            <td>{row.workDate}</td>
            <td>{row.enteredTime}</td>
            <td>{row.exitedTime}</td>
            <td>{row.stayDuration}</td>
            <td>{row.concentrationScore}</td>
            <td>{row.anxietyScore}</td>
            <td>{row.fatigueScore}</td>
            <td>{row.selfCriticismScore}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

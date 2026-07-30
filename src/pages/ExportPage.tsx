import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Copy, FileText, Printer, RotateCw } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { LoadingState } from "../components/States";
import { useAuth } from "../contexts/AuthContext";
import { getSessionsForExport } from "../services/sessions";
import { createJstDateRange, formatJstDateTime, toJstDateKey } from "../utils/date";
import {
  EXPORT_TABLE_HEADERS,
  createExportTableRows,
  generateSessionsMarkdown,
  type ExportSessionRecord,
  type ExportTableRow,
} from "../utils/export";
import { toUserMessage } from "../utils/errors";

interface GeneratedExport {
  startDate: string;
  endDate: string;
  generatedAt: Date;
  sessions: ExportSessionRecord[];
  rows: ExportTableRow[];
  markdown: string;
}

function initialDateValues(now = new Date()) {
  const today = toJstDateKey(now);
  return {
    startDate: `${today.slice(0, 7)}-01`,
    endDate: today,
  };
}

function displayDate(value: string): string {
  return value.replaceAll("-", "/");
}

export function ExportPage() {
  const { user } = useAuth();
  const initialDates = useMemo(() => initialDateValues(), []);
  const [startDate, setStartDate] = useState(initialDates.startDate);
  const [endDate, setEndDate] = useState(initialDates.endDate);
  const [dateError, setDateError] = useState("");
  const [fetchError, setFetchError] = useState("");
  const [copyMessage, setCopyMessage] = useState("");
  const [copyFailed, setCopyFailed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [generated, setGenerated] = useState<GeneratedExport | null>(null);
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

  useEffect(() => {
    if (!copyFailed) return;
    copyFallbackRef.current?.focus();
    copyFallbackRef.current?.select();
  }, [copyFailed]);

  const clearGeneratedOutput = () => {
    setGenerated(null);
    setFetchError("");
    setCopyMessage("");
    setCopyFailed(false);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setDateError("");
    clearGeneratedOutput();
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setDateError("");
    clearGeneratedOutput();
  };

  const generatePreview = async (event?: FormEvent) => {
    event?.preventDefault();
    setDateError("");
    setFetchError("");
    setCopyMessage("");
    setCopyFailed(false);

    if (startDate === "") {
      setDateError("開始日を入力してください。");
      return;
    }
    if (endDate === "") {
      setDateError("終了日を入力してください。");
      return;
    }

    const range = createJstDateRange(startDate, endDate);
    if (range === null) {
      setDateError(
        startDate > endDate
          ? "開始日は終了日以前の日付にしてください。"
          : "日付を正しく入力してください。",
      );
      return;
    }
    if (!user) {
      setFetchError("ログイン状態を確認できませんでした。再度ログインしてください。");
      return;
    }

    setIsLoading(true);
    setGenerated(null);
    try {
      const sessions = await getSessionsForExport(
        user.uid,
        range.start,
        range.endExclusive,
      );
      const period = { startDate, endDate };
      setGenerated({
        startDate,
        endDate,
        generatedAt: new Date(),
        sessions,
        rows: createExportTableRows(sessions, period),
        markdown: generateSessionsMarkdown(sessions, period),
      });
    } catch (error) {
      setFetchError(toUserMessage(error));
    } finally {
      setIsLoading(false);
    }
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

  const canOutput = Boolean(generated && generated.rows.length > 0);
  const targetCount =
    generated === null ? "未生成" : `${generated.sessions.length}件`;

  return (
    <div className="page export-page">
      <div className="no-print">
        <PageHeader
          eyebrow="EXPORT"
          title="記録をエクスポート"
          description="指定期間の記録をMarkdown表としてコピーしたり、ブラウザの印刷画面から印刷・PDF保存したりできます。"
        />

        <section className="card card--padded export-controls">
          <form
            className="export-period-form"
            onSubmit={(event) => void generatePreview(event)}
            noValidate
          >
            <div className="field">
              <label htmlFor="export-start-date">開始日</label>
              <input
                className="input"
                id="export-start-date"
                type="date"
                value={startDate}
                aria-describedby={dateError ? "export-date-error" : undefined}
                aria-invalid={dateError ? "true" : undefined}
                disabled={isLoading}
                onChange={(event) =>
                  handleStartDateChange(event.target.value)
                }
              />
            </div>
            <div className="field">
              <label htmlFor="export-end-date">終了日</label>
              <input
                className="input"
                id="export-end-date"
                type="date"
                value={endDate}
                aria-describedby={dateError ? "export-date-error" : undefined}
                aria-invalid={dateError ? "true" : undefined}
                disabled={isLoading}
                onChange={(event) => handleEndDateChange(event.target.value)}
              />
            </div>
            <button
              className="button button--primary export-generate-button"
              type="submit"
              disabled={isLoading}
            >
              <FileText aria-hidden="true" size={18} />
              {isLoading ? "生成しています…" : "プレビューを生成"}
            </button>
          </form>
          {dateError ? (
            <p className="field-error export-date-error" id="export-date-error" role="alert">
              {dateError}
            </p>
          ) : null}
        </section>

        <section className="export-result" aria-labelledby="export-preview-title">
          <div className="section-heading export-result__heading">
            <div>
              <h2 id="export-preview-title">Markdownプレビュー</h2>
              <p aria-live="polite">対象件数: {targetCount}</p>
            </div>
            <div className="action-row">
              <button
                className="button button--secondary"
                type="button"
                disabled={!canOutput || isLoading}
                onClick={() => void handleCopy()}
              >
                <Copy aria-hidden="true" size={17} />
                Markdownをコピー
              </button>
              <button
                className="button button--secondary"
                type="button"
                disabled={!canOutput || isLoading}
                onClick={() => window.print()}
              >
                <Printer aria-hidden="true" size={17} />
                印刷・PDF保存
              </button>
            </div>
          </div>

          {copyMessage ? (
            <p
              className={copyMessage.startsWith("Markdown") ? "copy-status" : "field-error"}
              role={copyMessage.startsWith("Markdown") ? "status" : "alert"}
            >
              {copyMessage}
            </p>
          ) : null}

          {isLoading ? (
            <LoadingState
              className="card card--flat export-loading"
              message="指定期間の記録を読み込んでいます…"
              size="inline"
            />
          ) : fetchError ? (
            <div className="card card--flat export-inline-error" role="alert">
              <p>記録を取得できませんでした。{fetchError}</p>
              <button
                className="button button--secondary button--small"
                type="button"
                onClick={() => void generatePreview()}
              >
                <RotateCw aria-hidden="true" size={16} />
                もう一度試す
              </button>
            </div>
          ) : generated ? (
            <>
              {generated.sessions.length === 0 ? (
                <p className="export-no-records" role="status">
                  指定した期間に記録はありません。未登録の日は「---」で表示しています。
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
              開始日と終了日を確認し、プレビューを生成してください。
            </div>
          )}
        </section>
      </div>

      {generated && generated.rows.length > 0 ? (
        <PrintReport generated={generated} />
      ) : null}
    </div>
  );
}

function PrintReport({ generated }: { generated: GeneratedExport }) {
  return (
    <article className="print-report" aria-hidden="true">
      <header className="print-report__header">
        <h1>図書館作業記録</h1>
        <dl>
          <div>
            <dt>対象期間</dt>
            <dd>
              {displayDate(generated.startDate)} ～ {displayDate(generated.endDate)}
            </dd>
          </div>
          <div>
            <dt>出力日時</dt>
            <dd>{formatJstDateTime(generated.generatedAt)}</dd>
          </div>
          <div>
            <dt>対象件数</dt>
            <dd>{generated.sessions.length}件</dd>
          </div>
        </dl>
      </header>
      <ExportDataTable
        className="export-data-table print-report__table"
        rows={generated.rows}
      />
    </article>
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
            <td>{row.actualWorkDuration}</td>
            <td>{row.concentrationScore}</td>
            <td>{row.anxietyScore}</td>
            <td>{row.fatigueScore}</td>
            <td>{row.selfCriticismDuration}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { Library } from "../types";
import {
  COMPLETION_STATUS_OPTIONS,
  formatMinutes,
} from "../utils/format";
import { differenceInMinutes, fromJstDateTimeLocal } from "../utils/date";
import {
  parseTimecardReport,
  validateTimecardReport,
  type ParsedTimecardReport,
  type TimecardReportFormErrors,
  type TimecardReportFormValues,
} from "../utils/timecardReport";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";
import { ScoreField } from "./ScoreField";

interface TimecardReportFormProps {
  initialValues: TimecardReportFormValues;
  libraries: Library[];
  isSaving: boolean;
  onSubmit: (values: ParsedTimecardReport) => void | Promise<void>;
  onCancel: () => void;
}

function errorMessages(errors: TimecardReportFormErrors): string[] {
  return Object.values(errors).filter(
    (message): message is string => typeof message === "string",
  );
}

export function TimecardReportForm({
  initialValues,
  libraries,
  isSaving,
  onSubmit,
  onCancel,
}: TimecardReportFormProps) {
  const formId = useId().replaceAll(":", "");
  const errorSummaryRef = useRef<HTMLElement>(null);
  const [values, setValues] =
    useState<TimecardReportFormValues>(initialValues);
  const [errors, setErrors] = useState<TimecardReportFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const confirmDiscard = useUnsavedChanges(isDirty);
  const messages = errorMessages(errors);

  useEffect(() => {
    if (messages.length > 0) {
      errorSummaryRef.current?.focus();
    }
  }, [messages.length]);

  const stayDuration = useMemo(() => {
    const enteredAt = fromJstDateTimeLocal(values.enteredAt);
    const exitedAt = fromJstDateTimeLocal(values.exitedAt);
    if (enteredAt === null || exitedAt === null) return null;
    const minutes = differenceInMinutes(enteredAt, exitedAt);
    return minutes >= 1 ? formatMinutes(minutes) : null;
  }, [values.enteredAt, values.exitedAt]);

  function updateField<K extends keyof TimecardReportFormValues>(
    field: K,
    value: TimecardReportFormValues[K],
  ) {
    const next = { ...values, [field]: value };
    setValues(next);
    setIsDirty(true);
    if (Object.keys(errors).length > 0) {
      setErrors(validateTimecardReport(next));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors = validateTimecardReport(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }
    const parsed = parseTimecardReport(values);
    if (parsed) void onSubmit(parsed);
  }

  const id = (suffix: string) => `${formId}-${suffix}`;

  return (
    <form
      className="record-form form-stack session-form"
      noValidate
      aria-busy={isSaving}
      onSubmit={handleSubmit}
    >
      {messages.length > 0 ? (
        <section
          ref={errorSummaryRef}
          className="form-error-summary error-summary"
          aria-labelledby={id("error-title")}
          role="alert"
          tabIndex={-1}
        >
          <h2 id={id("error-title")}>入力内容を確認してください</h2>
          <ul>
            {messages.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <fieldset className="form-section" disabled={isSaving}>
        <legend>利用情報</legend>
        <div className="form-grid">
          <div className="field field--wide">
            <label htmlFor={id("library")}>図書館</label>
            <select
              className="select"
              id={id("library")}
              value={values.libraryId}
              onChange={(event) =>
                updateField("libraryId", event.target.value)
              }
              aria-invalid={errors.libraryId ? true : undefined}
              aria-describedby={
                errors.libraryId ? id("library-error") : undefined
              }
              required
            >
              <option value="">図書館を選択してください</option>
              {libraries.map((library) => (
                <option key={library.id} value={library.id}>
                  {library.name}
                </option>
              ))}
            </select>
            {errors.libraryId ? (
              <p className="field-error" id={id("library-error")}>
                {errors.libraryId}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={id("entered-at")}>入室日時</label>
            <input
              className="input"
              id={id("entered-at")}
              type="datetime-local"
              value={values.enteredAt}
              onChange={(event) =>
                updateField("enteredAt", event.target.value)
              }
              aria-invalid={errors.enteredAt ? true : undefined}
              aria-describedby={
                errors.enteredAt
                  ? `${id("entered-at-hint")} ${id("entered-at-error")}`
                  : id("entered-at-hint")
              }
              required
            />
            <p className="field-help" id={id("entered-at-hint")}>
              日本時間。押し忘れた場合は修正できます。
            </p>
            {errors.enteredAt ? (
              <p className="field-error" id={id("entered-at-error")}>
                {errors.enteredAt}
              </p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor={id("exited-at")}>退出日時</label>
            <input
              className="input"
              id={id("exited-at")}
              type="datetime-local"
              value={values.exitedAt}
              onChange={(event) =>
                updateField("exitedAt", event.target.value)
              }
              aria-invalid={errors.exitedAt ? true : undefined}
              aria-describedby={
                errors.exitedAt
                  ? `${id("exited-at-hint")} ${id("exited-at-error")}`
                  : id("exited-at-hint")
              }
              required
            />
            <p className="field-help" id={id("exited-at-hint")}>
              最初に退出操作をした時刻です。
            </p>
            {errors.exitedAt ? (
              <p className="field-error" id={id("exited-at-error")}>
                {errors.exitedAt}
              </p>
            ) : null}
          </div>

          <p
            className="calculated-duration calculated-value field--wide"
            aria-live="polite"
          >
            滞在時間：
            <output>
              {stayDuration ??
                "入室・退出日時を入力すると自動計算されます"}
            </output>
          </p>
        </div>
      </fieldset>

      <fieldset className="form-section" disabled={isSaving}>
        <legend>その日の状態</legend>
        <div className="form-grid form-grid--single">
          <div className="score-grid score-fields">
            <ScoreField
              id={id("concentration")}
              name="concentrationScore"
              label="集中度"
              value={values.concentrationScore}
              onChange={(value) => updateField("concentrationScore", value)}
              description="0〜10の範囲で、記録しやすい感覚に近い値を選んでください。"
              {...(errors.concentrationScore
                ? { error: errors.concentrationScore }
                : {})}
              disabled={isSaving}
            />
            <ScoreField
              id={id("anxiety")}
              name="anxietyScore"
              label="焦り・不安"
              value={values.anxietyScore}
              onChange={(value) => updateField("anxietyScore", value)}
              description="0〜10の範囲で、記録しやすい感覚に近い値を選んでください。"
              {...(errors.anxietyScore ? { error: errors.anxietyScore } : {})}
              disabled={isSaving}
            />
            <ScoreField
              id={id("fatigue")}
              name="fatigueScore"
              label="疲労度"
              value={values.fatigueScore}
              onChange={(value) => updateField("fatigueScore", value)}
              description="0〜10の範囲で、終了時の感覚に近い値を選んでください。"
              {...(errors.fatigueScore ? { error: errors.fatigueScore } : {})}
              disabled={isSaving}
            />
            <ScoreField
              id={id("self-criticism")}
              name="selfCriticismScore"
              label="自己否定の割合"
              value={values.selfCriticismScore}
              onChange={(value) => updateField("selfCriticismScore", value)}
              description="作業時間全体のうち自己否定が占めた感覚的な割合です。0は「なし」、10は「ほぼ全体」の目安です。"
              {...(errors.selfCriticismScore
                ? { error: errors.selfCriticismScore }
                : {})}
              disabled={isSaving}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section" disabled={isSaving}>
        <legend>タスク</legend>
        <div className="form-grid form-grid--single">
          <div
            className="field choice-group"
            role="group"
            aria-labelledby={id("planned-task-label")}
          >
            <p className="field-label" id={id("planned-task-label")}>
              予定タスクを作成しましたか
            </p>
            <div className="choice-grid choice-list choice-list--inline">
              <div className="choice-card choice-option">
                <input
                  id={id("planned-yes")}
                  type="radio"
                  name="plannedTaskCreated"
                  checked={values.plannedTaskCreated}
                  onChange={() => updateField("plannedTaskCreated", true)}
                />
                <label htmlFor={id("planned-yes")}>はい</label>
              </div>
              <div className="choice-card choice-option">
                <input
                  id={id("planned-no")}
                  type="radio"
                  name="plannedTaskCreated"
                  checked={!values.plannedTaskCreated}
                  onChange={() => updateField("plannedTaskCreated", false)}
                />
                <label htmlFor={id("planned-no")}>いいえ</label>
              </div>
            </div>
          </div>

          <div className="field">
            <label htmlFor={id("planned-text")}>
              予定タスク <span className="optional-label">（任意）</span>
            </label>
            <textarea
              className="textarea"
              id={id("planned-text")}
              value={values.plannedTaskText}
              onChange={(event) =>
                updateField("plannedTaskText", event.target.value)
              }
              rows={3}
            />
          </div>

          <div className="field">
            <label htmlFor={id("actual-text")}>
              実際の作業内容 <span className="optional-label">（任意）</span>
            </label>
            <textarea
              className="textarea"
              id={id("actual-text")}
              value={values.actualTaskText}
              onChange={(event) =>
                updateField("actualTaskText", event.target.value)
              }
              rows={4}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="form-section" disabled={isSaving}>
        <legend>終了状況</legend>
        <div
          className="choice-grid choice-list"
          aria-invalid={errors.completionStatus ? true : undefined}
          aria-describedby={
            errors.completionStatus ? id("completion-error") : undefined
          }
        >
          {COMPLETION_STATUS_OPTIONS.map((option) => (
            <div className="choice-card choice-option" key={option.value}>
              <input
                id={id(`completion-${option.value}`)}
                type="radio"
                name="completionStatus"
                value={option.value}
                checked={values.completionStatus === option.value}
                onChange={() =>
                  updateField("completionStatus", option.value)
                }
              />
              <label htmlFor={id(`completion-${option.value}`)}>
                {option.label}
              </label>
            </div>
          ))}
        </div>
        {errors.completionStatus ? (
          <p className="field-error" id={id("completion-error")}>
            {errors.completionStatus}
          </p>
        ) : null}
      </fieldset>

      <fieldset className="form-section" disabled={isSaving}>
        <legend>メモ</legend>
        <div className="field">
          <label htmlFor={id("note")}>
            自由メモ <span className="optional-label">（任意）</span>
          </label>
          <textarea
            className="textarea"
            id={id("note")}
            value={values.note}
            onChange={(event) => updateField("note", event.target.value)}
            rows={5}
          />
        </div>
      </fieldset>

      <div className="save-actions form-actions">
        {isDirty ? (
          <span className="unsaved-indicator">未保存の変更があります</span>
        ) : null}
        <button
          className="button button--secondary"
          type="button"
          onClick={() => {
            if (confirmDiscard()) onCancel();
          }}
          disabled={isSaving}
        >
          キャンセル
        </button>
        <button
          className="button button--primary"
          type="submit"
          disabled={isSaving}
        >
          {isSaving ? "保存中…" : "日報を保存"}
        </button>
      </div>
    </form>
  );
}

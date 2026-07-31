import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  EditableLibrarySessionFields,
  Library,
  SessionFormErrors,
  SessionFormValues,
} from "../types";
import { differenceInMinutes, fromJstDateTimeLocal } from "../utils/date";
import {
  COMPLETION_STATUS_OPTIONS,
  formatMinutes,
} from "../utils/format";
import {
  hasValidationErrors,
  parseSessionForm,
  validateSessionForm,
} from "../utils/validation";
import { DurationField } from "./DurationField";
import { ScoreField } from "./ScoreField";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";

export interface SessionFormProps {
  initialValues: SessionFormValues;
  libraries: Library[];
  mode: "create" | "edit";
  isSaving: boolean;
  onSubmit: (values: EditableLibrarySessionFields) => void | Promise<void>;
  onCancel: () => void;
}

function errorMessages(errors: SessionFormErrors): string[] {
  return Object.values(errors).filter(
    (message): message is string => typeof message === "string",
  );
}

function describedBy(
  ...ids: Array<string | false | undefined>
): string | undefined {
  const value = ids.filter(Boolean).join(" ");
  return value === "" ? undefined : value;
}

export function SessionForm({
  initialValues,
  libraries,
  mode,
  isSaving,
  onSubmit,
  onCancel,
}: SessionFormProps) {
  const formId = useId().replaceAll(":", "");
  const errorSummaryRef = useRef<HTMLElement>(null);
  const shouldFocusErrors = useRef(false);
  const [values, setValues] = useState<SessionFormValues>(initialValues);
  const [errors, setErrors] = useState<SessionFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const confirmDiscard = useUnsavedChanges(isDirty);

  const messages = errorMessages(errors);
  useEffect(() => {
    if (shouldFocusErrors.current && messages.length > 0) {
      errorSummaryRef.current?.focus();
      shouldFocusErrors.current = false;
    }
  }, [messages.length]);

  const stayDuration = useMemo(() => {
    const enteredAt = fromJstDateTimeLocal(values.enteredAt);
    const exitedAt = fromJstDateTimeLocal(values.exitedAt);
    if (enteredAt === null || exitedAt === null) return null;

    const minutes = differenceInMinutes(enteredAt, exitedAt);
    return minutes > 0 ? formatMinutes(minutes) : null;
  }, [values.enteredAt, values.exitedAt]);

  function updateField<K extends keyof SessionFormValues>(
    field: K,
    value: SessionFormValues[K],
  ) {
    const nextValues: SessionFormValues = { ...values, [field]: value };
    setValues(nextValues);
    setIsDirty(true);
    if (hasValidationErrors(errors)) {
      setErrors(validateSessionForm(nextValues));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors = validateSessionForm(values);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      shouldFocusErrors.current = true;
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    const parsed = parseSessionForm(values);
    if (parsed !== null) {
      onSubmit(parsed);
    }
  }

  const libraryId = `${formId}-library`;
  const enteredAtId = `${formId}-entered-at`;
  const exitedAtId = `${formId}-exited-at`;
  const actualWorkId = `${formId}-actual-work`;
  const concentrationId = `${formId}-concentration`;
  const anxietyId = `${formId}-anxiety`;
  const fatigueId = `${formId}-fatigue`;
  const selfCriticismId = `${formId}-self-criticism`;
  const plannedTaskId = `${formId}-planned-task`;
  const plannedTaskTextId = `${formId}-planned-task-text`;
  const actualTaskTextId = `${formId}-actual-task-text`;
  const completionStatusId = `${formId}-completion-status`;
  const noteId = `${formId}-note`;

  return (
    <form
      className="record-form form-stack session-form"
      noValidate
      aria-busy={isSaving}
      onSubmit={handleSubmit}
    >
      {messages.length > 0 && (
        <section
          ref={errorSummaryRef}
          className="form-error-summary error-summary"
          aria-labelledby={`${formId}-error-title`}
          role="alert"
          tabIndex={-1}
        >
          <h2 id={`${formId}-error-title`}>入力内容を確認してください</h2>
          <ul>
            {messages.map((message, index) => (
              <li key={`${message}-${index}`}>{message}</li>
            ))}
          </ul>
        </section>
      )}

      <fieldset className="form-section" disabled={isSaving}>
        <legend>利用情報</legend>

        <div className="form-grid">
        <div className="field field--wide form-field">
          <label className="field-label form-label" htmlFor={libraryId}>
            図書館
          </label>
          <select
            className="select"
            id={libraryId}
            name="libraryId"
            value={values.libraryId}
            onChange={(event) => updateField("libraryId", event.target.value)}
            aria-invalid={errors.libraryId ? true : undefined}
            aria-describedby={describedBy(
              libraries.length === 0 && `${libraryId}-hint`,
              errors.libraryId && `${libraryId}-error`,
            )}
            required
          >
            <option value="">図書館を選択してください</option>
            {libraries.map((library) => (
              <option key={library.id} value={library.id}>
                {library.name}
                {library.archivedAt ? "（削除済み）" : ""}
              </option>
            ))}
          </select>
          {libraries.length === 0 && (
            <p
              className="field-help field-hint"
              id={`${libraryId}-hint`}
            >
              先に図書館を登録すると、ここから選択できます。
            </p>
          )}
          {errors.libraryId && (
            <p className="field-error" id={`${libraryId}-error`}>
              {errors.libraryId}
            </p>
          )}
        </div>

          <div className="field form-field">
            <label className="field-label form-label" htmlFor={enteredAtId}>
              入室日時
            </label>
            <input
              className="input"
              id={enteredAtId}
              name="enteredAt"
              type="datetime-local"
              value={values.enteredAt}
              onChange={(event) => updateField("enteredAt", event.target.value)}
              aria-invalid={errors.enteredAt ? true : undefined}
              aria-describedby={describedBy(
                `${enteredAtId}-hint`,
                errors.enteredAt && `${enteredAtId}-error`,
              )}
              required
            />
            <p
              className="field-help field-hint"
              id={`${enteredAtId}-hint`}
            >
              日本時間で入力してください。
            </p>
            {errors.enteredAt && (
              <p className="field-error" id={`${enteredAtId}-error`}>
                {errors.enteredAt}
              </p>
            )}
          </div>

          <div className="field form-field">
            <label className="field-label form-label" htmlFor={exitedAtId}>
              退室日時
            </label>
            <input
              className="input"
              id={exitedAtId}
              name="exitedAt"
              type="datetime-local"
              value={values.exitedAt}
              onChange={(event) => updateField("exitedAt", event.target.value)}
              aria-invalid={errors.exitedAt ? true : undefined}
              aria-describedby={describedBy(
                `${exitedAtId}-hint`,
                errors.exitedAt && `${exitedAtId}-error`,
              )}
              required
            />
            <p
              className="field-help field-hint"
              id={`${exitedAtId}-hint`}
            >
              日本時間で入力してください。
            </p>
            {errors.exitedAt && (
              <p className="field-error" id={`${exitedAtId}-error`}>
                {errors.exitedAt}
              </p>
            )}
          </div>
        <p
          className="calculated-duration calculated-value field--wide"
          aria-live="polite"
        >
          滞在時間：
          <output>
            {stayDuration ?? "入室・退室日時を入力すると自動計算されます"}
          </output>
        </p>
        </div>
      </fieldset>

      <fieldset className="form-section" disabled={isSaving}>
        <legend>作業中の状態</legend>

        <div className="form-grid form-grid--single">
        <DurationField
          id={actualWorkId}
          label="実作業時間"
          hours={values.actualWorkHours}
          minutes={values.actualWorkMinutes}
          onHoursChange={(value) => updateField("actualWorkHours", value)}
          onMinutesChange={(value) => updateField("actualWorkMinutes", value)}
          hoursName="actualWorkHours"
          minutesName="actualWorkMinutes"
          description="休憩を除き、実際に作業した時間を入力します。"
          {...(errors.actualWorkMinutes
            ? { error: errors.actualWorkMinutes }
            : {})}
          disabled={isSaving}
          required
        />

        <div className="score-grid score-fields">
          <ScoreField
            id={concentrationId}
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
            id={anxietyId}
            name="anxietyScore"
            label="作業中の焦り"
            value={values.anxietyScore}
            onChange={(value) => updateField("anxietyScore", value)}
            description="0〜10の範囲で、記録しやすい感覚に近い値を選んでください。"
            {...(errors.anxietyScore ? { error: errors.anxietyScore } : {})}
            disabled={isSaving}
          />
          <ScoreField
            id={fatigueId}
            name="fatigueScore"
            label="終了直後の疲労"
            value={values.fatigueScore}
            onChange={(value) => updateField("fatigueScore", value)}
            description="0〜10の範囲で、記録しやすい感覚に近い値を選んでください。"
            {...(errors.fatigueScore ? { error: errors.fatigueScore } : {})}
            disabled={isSaving}
          />
          <ScoreField
            id={selfCriticismId}
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
          aria-labelledby={`${plannedTaskId}-label`}
          aria-describedby={
            errors.plannedTaskCreated
              ? `${plannedTaskId}-error`
              : undefined
          }
        >
          <p
            className="field-label form-label"
            id={`${plannedTaskId}-label`}
          >
            開始時に予定タスクを設定できましたか
          </p>
          <div className="choice-grid choice-list choice-list--inline">
            <div className="choice-card choice-option">
              <input
                id={`${plannedTaskId}-yes`}
                type="radio"
                name="plannedTaskCreated"
                value="yes"
                checked={values.plannedTaskCreated}
                onChange={() => updateField("plannedTaskCreated", true)}
              />
              <label htmlFor={`${plannedTaskId}-yes`}>
                はい
              </label>
            </div>
            <div className="choice-card choice-option">
              <input
                id={`${plannedTaskId}-no`}
                type="radio"
                name="plannedTaskCreated"
                value="no"
                checked={!values.plannedTaskCreated}
                onChange={() => updateField("plannedTaskCreated", false)}
              />
              <label htmlFor={`${plannedTaskId}-no`}>
                いいえ
              </label>
            </div>
          </div>
          {errors.plannedTaskCreated && (
            <p className="field-error" id={`${plannedTaskId}-error`}>
              {errors.plannedTaskCreated}
            </p>
          )}
        </div>

        <div className="field form-field">
          <label
            className="field-label form-label"
            htmlFor={plannedTaskTextId}
          >
            予定タスク内容
            <span className="optional-label">（任意）</span>
          </label>
          <textarea
            className="textarea"
            id={plannedTaskTextId}
            name="plannedTaskText"
            value={values.plannedTaskText}
            onChange={(event) =>
              updateField("plannedTaskText", event.target.value)
            }
            rows={3}
          />
        </div>

        <div className="field form-field">
          <label
            className="field-label form-label"
            htmlFor={actualTaskTextId}
          >
            実際に行った作業
            <span className="optional-label">（任意）</span>
          </label>
          <textarea
            className="textarea"
            id={actualTaskTextId}
            name="actualTaskText"
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
        <p
          className="form-section__hint field-help field-hint"
          id={`${completionStatusId}-hint`}
        >
          当初の予定と比べて、近いものを選んでください。
        </p>
        <div
          className="choice-grid choice-list"
          aria-describedby={describedBy(
            `${completionStatusId}-hint`,
            errors.completionStatus && `${completionStatusId}-error`,
          )}
          aria-invalid={errors.completionStatus ? true : undefined}
        >
          {COMPLETION_STATUS_OPTIONS.map((option) => (
            <div className="choice-card choice-option" key={option.value}>
              <input
                id={`${completionStatusId}-${option.value}`}
                type="radio"
                name="completionStatus"
                value={option.value}
                checked={values.completionStatus === option.value}
                onChange={() =>
                  updateField("completionStatus", option.value)
                }
              />
              <label htmlFor={`${completionStatusId}-${option.value}`}>
                {option.label}
              </label>
            </div>
          ))}
        </div>
        {errors.completionStatus && (
          <p className="field-error" id={`${completionStatusId}-error`}>
            {errors.completionStatus}
          </p>
        )}
      </fieldset>

      <fieldset className="form-section" disabled={isSaving}>
        <legend>メモ</legend>
        <div className="field form-field">
          <label className="field-label form-label" htmlFor={noteId}>
            自由メモ
            <span className="optional-label">（任意）</span>
          </label>
          <textarea
            className="textarea"
            id={noteId}
            name="note"
            value={values.note}
            onChange={(event) => updateField("note", event.target.value)}
            rows={5}
          />
        </div>
      </fieldset>

      <div className="save-actions form-actions">
        {isDirty && <span className="unsaved-indicator">未保存の変更があります</span>}
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
          {isSaving
            ? "保存中…"
            : mode === "create"
              ? "記録を保存"
              : "変更を保存"}
        </button>
      </div>
    </form>
  );
}

export default SessionForm;

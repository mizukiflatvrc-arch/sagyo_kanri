import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type { NextDayReaction, NextDayReactionFormValues } from "../types";
import { NEXT_DAY_REACTION_OPTIONS } from "../utils/format";
import {
  hasValidationErrors,
  validateNextDayReactionForm,
} from "../utils/validation";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";

type NextDayReactionFormErrors = Partial<
  Record<keyof NextDayReactionFormValues, string>
>;

export interface NextDayReactionFormProps {
  initialValues: NextDayReactionFormValues;
  isSaving: boolean;
  onSubmit: (values: NextDayReactionFormValues) => void | Promise<void>;
  onCancel: () => void;
}

const REACTION_OPTIONS = NEXT_DAY_REACTION_OPTIONS.filter(
  (option) => option.value !== "pending",
);

function validateValues(
  values: NextDayReactionFormValues,
): NextDayReactionFormErrors {
  const errors = validateNextDayReactionForm(values);
  if (values.nextDayReaction === "pending") {
    errors.nextDayReaction = "翌日の反動を選択してください";
  }
  return errors;
}

export function NextDayReactionForm({
  initialValues,
  isSaving,
  onSubmit,
  onCancel,
}: NextDayReactionFormProps) {
  const formId = useId().replaceAll(":", "");
  const errorSummaryRef = useRef<HTMLElement>(null);
  const shouldFocusErrors = useRef(false);
  const [values, setValues] =
    useState<NextDayReactionFormValues>(initialValues);
  const [errors, setErrors] = useState<NextDayReactionFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const confirmDiscard = useUnsavedChanges(isDirty);

  useEffect(() => {
    if (shouldFocusErrors.current && errors.nextDayReaction) {
      errorSummaryRef.current?.focus();
      shouldFocusErrors.current = false;
    }
  }, [errors.nextDayReaction]);

  function updateReaction(nextDayReaction: NextDayReaction) {
    const nextValues = { ...values, nextDayReaction };
    setValues(nextValues);
    setIsDirty(true);
    if (hasValidationErrors(errors)) {
      setErrors(validateValues(nextValues));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors = validateValues(values);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      shouldFocusErrors.current = true;
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    onSubmit({
      nextDayReaction: values.nextDayReaction,
      nextDayNote: values.nextDayNote.trim(),
    });
  }

  const reactionId = `${formId}-reaction`;
  const noteId = `${formId}-note`;

  return (
    <form
      className="record-form form-stack next-day-reaction-form"
      noValidate
      aria-busy={isSaving}
      onSubmit={handleSubmit}
    >
      {errors.nextDayReaction && (
        <section
          ref={errorSummaryRef}
          className="form-error-summary error-summary"
          aria-labelledby={`${formId}-error-title`}
          role="alert"
          tabIndex={-1}
        >
          <h2 id={`${formId}-error-title`}>入力内容を確認してください</h2>
          <ul>
            <li>{errors.nextDayReaction}</li>
          </ul>
        </section>
      )}

      <fieldset
        className="form-section"
        disabled={isSaving}
        aria-describedby={[
          `${reactionId}-hint`,
          errors.nextDayReaction ? `${reactionId}-error` : "",
        ]
          .filter(Boolean)
          .join(" ")}
        aria-invalid={errors.nextDayReaction ? true : undefined}
      >
        <legend>翌日の反動</legend>
        <p
          className="form-section__hint field-help field-hint"
          id={`${reactionId}-hint`}
        >
          翌日の状態に近いものを選んでください。
        </p>
        <div className="form-grid form-grid--single">
          <div className="field choice-group">
            <div className="choice-grid choice-list choice-list--cards">
              {REACTION_OPTIONS.map((option) => (
                <div className="choice-card choice-option" key={option.value}>
                  <input
                    id={`${reactionId}-${option.value}`}
                    type="radio"
                    name="nextDayReaction"
                    value={option.value}
                    checked={values.nextDayReaction === option.value}
                    onChange={() => updateReaction(option.value)}
                  />
                  <label htmlFor={`${reactionId}-${option.value}`}>
                    {option.label}
                  </label>
                </div>
              ))}
            </div>
            {errors.nextDayReaction && (
              <p className="field-error" id={`${reactionId}-error`}>
                {errors.nextDayReaction}
              </p>
            )}
          </div>

          <div className="field form-field">
            <label className="field-label form-label" htmlFor={noteId}>
              翌日の補足メモ
              <span className="optional-label">（任意）</span>
            </label>
            <textarea
              className="textarea"
              id={noteId}
              name="nextDayNote"
              value={values.nextDayNote}
          onChange={(event) =>
            {
              setValues((current) => ({
                ...current,
                nextDayNote: event.target.value,
              }));
              setIsDirty(true);
            }
          }
              rows={5}
              disabled={isSaving}
            />
          </div>
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
          {isSaving ? "保存中…" : "翌日の状態を保存"}
        </button>
      </div>
    </form>
  );
}

export default NextDayReactionForm;

import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
} from "react";
import type {
  EditableLibraryFields,
  LibraryFormErrors,
  LibraryFormValues,
} from "../types";
import {
  hasValidationErrors,
  validateLibraryForm,
} from "../utils/validation";
import { useUnsavedChanges } from "../hooks/useUnsavedChanges";

export interface LibraryFormProps {
  initialValues: LibraryFormValues;
  mode: "create" | "edit";
  isSaving: boolean;
  onSubmit: (values: EditableLibraryFields) => void | Promise<void>;
  onCancel: () => void;
}

function errorMessages(errors: LibraryFormErrors): string[] {
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

export function LibraryForm({
  initialValues,
  mode,
  isSaving,
  onSubmit,
  onCancel,
}: LibraryFormProps) {
  const formId = useId().replaceAll(":", "");
  const errorSummaryRef = useRef<HTMLElement>(null);
  const shouldFocusErrors = useRef(false);
  const [values, setValues] = useState<LibraryFormValues>(initialValues);
  const [errors, setErrors] = useState<LibraryFormErrors>({});
  const [isDirty, setIsDirty] = useState(false);
  const confirmDiscard = useUnsavedChanges(isDirty);

  const messages = errorMessages(errors);
  useEffect(() => {
    if (shouldFocusErrors.current && messages.length > 0) {
      errorSummaryRef.current?.focus();
      shouldFocusErrors.current = false;
    }
  }, [messages.length]);

  function updateField<K extends keyof LibraryFormValues>(
    field: K,
    value: LibraryFormValues[K],
  ) {
    const nextValues: LibraryFormValues = { ...values, [field]: value };
    setValues(nextValues);
    setIsDirty(true);
    if (hasValidationErrors(errors)) {
      setErrors(validateLibraryForm(nextValues));
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSaving) return;

    const nextErrors = validateLibraryForm(values);
    setErrors(nextErrors);
    if (hasValidationErrors(nextErrors)) {
      shouldFocusErrors.current = true;
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    const latitude = values.latitude.trim();
    const longitude = values.longitude.trim();
    const parsed: EditableLibraryFields = {
      name: values.name.trim(),
      googleMapsUrl: values.googleMapsUrl.trim(),
      ...(latitude === "" ? {} : { latitude: Number(latitude) }),
      ...(longitude === "" ? {} : { longitude: Number(longitude) }),
    };
    onSubmit(parsed);
  }

  const nameId = `${formId}-name`;
  const mapUrlId = `${formId}-map-url`;
  const latitudeId = `${formId}-latitude`;
  const longitudeId = `${formId}-longitude`;

  return (
    <form
      className="record-form form-stack library-form"
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

      <div className="form-section">
        <div className="form-grid">
          <div className="field field--wide form-field">
            <label className="field-label form-label" htmlFor={nameId}>
              図書館名
            </label>
            <input
              className="input"
              id={nameId}
              name="name"
              type="text"
              autoComplete="organization"
              value={values.name}
              onChange={(event) => updateField("name", event.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? `${nameId}-error` : undefined}
              disabled={isSaving}
              required
            />
            {errors.name && (
              <p className="field-error" id={`${nameId}-error`}>
                {errors.name}
              </p>
            )}
          </div>

          <div className="field field--wide form-field">
            <label className="field-label form-label" htmlFor={mapUrlId}>
              GoogleマップURL
              <span className="optional-label">（任意）</span>
            </label>
            <input
              className="input"
              id={mapUrlId}
              name="googleMapsUrl"
              type="url"
              inputMode="url"
              placeholder="https://maps.google.com/…"
              value={values.googleMapsUrl}
              onChange={(event) =>
                updateField("googleMapsUrl", event.target.value)
              }
              aria-invalid={errors.googleMapsUrl ? true : undefined}
              aria-describedby={describedBy(
                `${mapUrlId}-hint`,
                errors.googleMapsUrl && `${mapUrlId}-error`,
              )}
              disabled={isSaving}
            />
            <p
              className="field-help field-hint"
              id={`${mapUrlId}-hint`}
            >
              ブラウザで開ける共有URLを入力できます。
            </p>
            {errors.googleMapsUrl && (
              <p className="field-error" id={`${mapUrlId}-error`}>
                {errors.googleMapsUrl}
              </p>
            )}
          </div>

          <div className="field form-field">
            <label className="field-label form-label" htmlFor={latitudeId}>
              緯度
              <span className="optional-label">（任意）</span>
            </label>
            <input
              className="input"
              id={latitudeId}
              name="latitude"
              type="text"
              inputMode="decimal"
              placeholder="35.681236"
              value={values.latitude}
              onChange={(event) => updateField("latitude", event.target.value)}
              aria-invalid={errors.latitude ? true : undefined}
              aria-describedby={describedBy(
                `${latitudeId}-hint`,
                errors.latitude && `${latitudeId}-error`,
              )}
              disabled={isSaving}
            />
            <p
              className="field-help field-hint"
              id={`${latitudeId}-hint`}
            >
              -90〜90の範囲で入力します。
            </p>
            {errors.latitude && (
              <p className="field-error" id={`${latitudeId}-error`}>
                {errors.latitude}
              </p>
            )}
          </div>

          <div className="field form-field">
            <label className="field-label form-label" htmlFor={longitudeId}>
              経度
              <span className="optional-label">（任意）</span>
            </label>
            <input
              className="input"
              id={longitudeId}
              name="longitude"
              type="text"
              inputMode="decimal"
              placeholder="139.767125"
              value={values.longitude}
              onChange={(event) => updateField("longitude", event.target.value)}
              aria-invalid={errors.longitude ? true : undefined}
              aria-describedby={describedBy(
                `${longitudeId}-hint`,
                errors.longitude && `${longitudeId}-error`,
              )}
              disabled={isSaving}
            />
            <p
              className="field-help field-hint"
              id={`${longitudeId}-hint`}
            >
              -180〜180の範囲で入力します。
            </p>
            {errors.longitude && (
              <p className="field-error" id={`${longitudeId}-error`}>
                {errors.longitude}
              </p>
            )}
          </div>
        </div>
      </div>

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
              ? "図書館を登録"
              : "変更を保存"}
        </button>
      </div>
    </form>
  );
}

export default LibraryForm;

interface ScoreFieldProps {
  id: string;
  label: string;
  value: number;
  onChange: (value: number) => void;
  name?: string | undefined;
  description?: string | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
}

export function ScoreField({
  id,
  label,
  value,
  onChange,
  name,
  description,
  error,
  disabled = false,
}: ScoreFieldProps) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={`form-field score-field${error ? " score-field--error" : ""}`}
    >
      <div className="score-field__header">
        <label className="score-field__label" htmlFor={id}>
          {label}
        </label>
        <output className="score-field__value" htmlFor={id}>
          <strong>{value}</strong>
          <span aria-hidden="true"> / 10</span>
        </output>
      </div>
      {description ? (
        <p className="field-hint field-description" id={descriptionId}>
          {description}
        </p>
      ) : null}
      <input
        className="score-field__input"
        id={id}
        name={name}
        type="range"
        min={0}
        max={10}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.currentTarget.value))}
        disabled={disabled}
        aria-valuetext={`${value} / 10`}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy || undefined}
      />
      <div className="score-field__scale" aria-hidden="true">
        <span>0</span>
        <span>5</span>
        <span>10</span>
      </div>
      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

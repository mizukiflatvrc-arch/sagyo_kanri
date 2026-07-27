interface DurationFieldProps {
  id: string;
  label: string;
  hours: string;
  minutes: string;
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  hoursName?: string | undefined;
  minutesName?: string | undefined;
  description?: string | undefined;
  error?: string | undefined;
  disabled?: boolean | undefined;
  required?: boolean | undefined;
}

export function DurationField({
  id,
  label,
  hours,
  minutes,
  onHoursChange,
  onMinutesChange,
  hoursName,
  minutesName,
  description,
  error,
  disabled = false,
  required = false,
}: DurationFieldProps) {
  const hoursId = `${id}-hours`;
  const minutesId = `${id}-minutes`;
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;
  const describedBy = [
    description ? descriptionId : null,
    error ? errorId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <fieldset
      className={`form-field duration-field${error ? " duration-field--error" : ""}`}
      disabled={disabled}
      aria-describedby={describedBy || undefined}
    >
      <legend className="duration-field__legend">
        {label}
        {required ? (
          <span className="field-required" aria-label="必須">
            *
          </span>
        ) : null}
      </legend>
      {description ? (
        <p className="field-hint field-description" id={descriptionId}>
          {description}
        </p>
      ) : null}

      <div className="duration-field__controls">
        <div className="duration-field__control">
          <label className="sr-only" htmlFor={hoursId}>
            {label}（時間）
          </label>
          <input
            className="input duration-field__input"
            id={hoursId}
            name={hoursName ?? `${id}Hours`}
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={hours}
            onChange={(event) => onHoursChange(event.currentTarget.value)}
            required={required}
            aria-invalid={Boolean(error)}
          />
          <span className="duration-field__unit" aria-hidden="true">
            時間
          </span>
        </div>

        <div className="duration-field__control">
          <label className="sr-only" htmlFor={minutesId}>
            {label}（分）
          </label>
          <input
            className="input duration-field__input"
            id={minutesId}
            name={minutesName ?? `${id}Minutes`}
            type="number"
            inputMode="numeric"
            min={0}
            max={59}
            step={1}
            value={minutes}
            onChange={(event) => onMinutesChange(event.currentTarget.value)}
            required={required}
            aria-invalid={Boolean(error)}
          />
          <span className="duration-field__unit" aria-hidden="true">
            分
          </span>
        </div>
      </div>

      {error ? (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

import { useId } from "react";

function FieldShell({ id, label, hint, error, optional, children }) {
  return (
    <div className={`field${error ? " field--error" : ""}`}>
      {label && (
        <label className="field__label" htmlFor={id}>
          {label} {optional && <span className="opt">(optional)</span>}
        </label>
      )}
      {children}
      {hint && !error && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-err`} role="alert">
          {error}
        </span>
      )}
    </div>
  );
}

function ariaFor(id, hint, error) {
  return {
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${id}-err` : hint ? `${id}-hint` : undefined,
  };
}

export function Input({ label, hint, error, optional, id: idProp, className = "", ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <input id={id} className={`field__control ${className}`.trim()} {...ariaFor(id, hint, error)} {...rest} />
    </FieldShell>
  );
}

export function Select({ label, hint, error, optional, id: idProp, className = "", children, ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <select id={id} className={`field__control ${className}`.trim()} {...ariaFor(id, hint, error)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export function Textarea({ label, hint, error, optional, id: idProp, className = "", ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional}>
      <textarea id={id} className={`field__control ${className}`.trim()} {...ariaFor(id, hint, error)} {...rest} />
    </FieldShell>
  );
}

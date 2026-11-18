import { useId } from "react";
import Icon from "./Icon";

function FieldShell({ id, label, hint, error, optional, hideLabel, className = "", children }) {
  return (
    <div className={`field${error ? " field--error" : ""} ${className}`.trim()}>
      {label && (
        <label className={hideLabel ? "sr-only" : "field__label"} htmlFor={id}>
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
          <Icon name="alert" size={13} /> {error}
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

/**
 * Text input with label, hint and error. `icon` adds a leading icon (e.g. "search");
 * `hideLabel` keeps the label for screen readers only (toolbars).
 */
export function Input({ label, hint, error, optional, hideLabel, icon, fieldClassName, id: idProp, className = "", ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  const input = <input id={id} className={`field__control ${className}`.trim()} {...ariaFor(id, hint, error)} {...rest} />;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      {icon ? (
        <span className="field__wrap">
          <Icon name={icon} size={16} className="field__icon" />
          {input}
        </span>
      ) : (
        input
      )}
    </FieldShell>
  );
}

export function Select({ label, hint, error, optional, hideLabel, fieldClassName, id: idProp, className = "", children, ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      <select id={id} className={`field__control ${className}`.trim()} {...ariaFor(id, hint, error)} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export function Textarea({ label, hint, error, optional, hideLabel, fieldClassName, id: idProp, className = "", ...rest }) {
  const auto = useId();
  const id = idProp || auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} optional={optional} hideLabel={hideLabel} className={fieldClassName}>
      <textarea id={id} className={`field__control ${className}`.trim()} {...ariaFor(id, hint, error)} {...rest} />
    </FieldShell>
  );
}

/** Accessible on/off switch backed by a real checkbox. */
export function Switch({ label, description, checked, onChange, ...rest }) {
  return (
    <label className="switch">
      <input type="checkbox" role="switch" checked={checked} onChange={onChange} {...rest} />
      <span className="switch__track" aria-hidden="true" />
      <span className="switch__text">
        <span className="switch__label">{label}</span>
        {description && <span className="muted small">{description}</span>}
      </span>
    </label>
  );
}

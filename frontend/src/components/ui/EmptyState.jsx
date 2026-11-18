import Icon from "./Icon";

/** Friendly placeholder for empty lists. `compact` drops the dashed frame for use inside cards. */
export default function EmptyState({ icon = "car", title, text, compact = false, children }) {
  return (
    <div className={`state${compact ? " state--compact" : ""}`}>
      <div className="state__icon">
        <Icon name={icon} size={22} />
      </div>
      <div className="state__title">{title}</div>
      {text && <p className="state__text">{text}</p>}
      {children && <div className="state__actions">{children}</div>}
    </div>
  );
}

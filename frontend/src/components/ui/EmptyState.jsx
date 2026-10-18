import Icon from "./Icon";

export default function EmptyState({ icon = "car", title, text, children }) {
  return (
    <div className="state">
      <div className="state__icon">
        <Icon name={icon} size={28} />
      </div>
      <div className="state__title">{title}</div>
      {text && <p className="state__text">{text}</p>}
      {children && <div className="state__actions">{children}</div>}
    </div>
  );
}

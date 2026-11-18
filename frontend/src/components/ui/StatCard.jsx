import Icon from "./Icon";

/** KPI tile: label + icon on top, a big tabular value, optional hint underneath. */
export default function StatCard({ label, value, icon, tone, hint, action, className = "" }) {
  return (
    <div className={`card stat-card ${className}`.trim()}>
      <div className="stat-card__top">
        <span className="stat-card__label">{label}</span>
        {icon && (
          <span className={`stat-card__icon${tone ? ` stat-card__icon--${tone}` : ""}`} aria-hidden="true">
            <Icon name={icon} size={16} />
          </span>
        )}
      </div>
      <strong className="stat-card__value">{value}</strong>
      {(hint || action) && (
        <span className="stat-card__hint">
          {hint}
          {action}
        </span>
      )}
    </div>
  );
}

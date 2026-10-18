import Icon from "./Icon";
import { statusMeta } from "../../lib/treatments";

/** Status is always shown as icon + text, never colour alone. */
export default function StatusPill({ status = "unknown", label, className = "" }) {
  const meta = statusMeta(status);
  return (
    <span className={`badge badge--${status in { ok: 1, due_soon: 1, overdue: 1 } ? status : "unknown"} status-pill ${className}`.trim()}>
      <Icon name={meta.icon} size={14} />
      <span className="status-pill__text">{label || meta.label}</span>
    </span>
  );
}

import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import StatusPill from "./ui/StatusPill";
import Button from "./ui/Button";
import { formatDate, formatKm, dueText } from "../lib/format";
import { itemLabel, treatmentInfo } from "../lib/treatments";
import { t } from "../i18n";

const TRACKED = ["ok", "due_soon", "overdue"];
const URGENCY = { overdue: 0, due_soon: 1, ok: 2 };

function pct(item) {
  if (typeof item.progress === "number") return Math.round(Math.max(0, Math.min(1, item.progress)) * 100);
  return item.status === "overdue" ? 100 : 0;
}

/** Overdue first, then the soonest due (by days left). */
function byUrgency(a, b) {
  const u = (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9);
  if (u !== 0) return u;
  return (a.remaining_days ?? Infinity) - (b.remaining_days ?? Infinity);
}

function whenText(item) {
  const bits = [];
  if (item.due_date) bits.push(t("due {date}", { date: formatDate(item.due_date) }));
  if (item.due_km) bits.push(t("at {km}", { km: formatKm(item.due_km) }));
  return bits.join(t(" or "));
}

function CoverageNote({ status, coverage }) {
  if (!coverage || coverage.known === 0) return null;
  const text = t("{known} of {tracked} categories tracked", { known: coverage.known, tracked: coverage.tracked });
  if (status === "unknown") {
    return (
      <p className="maint-note">
        <Icon name="help" size={14} /> {t("Not enough history to call this vehicle healthy ({text}).", { text })}
      </p>
    );
  }
  return <p className="muted small">{text}</p>;
}

export default function MaintenanceStatusPanel({
  items = [],
  carId,
  status = "unknown",
  coverage,
  odometer,
  onUpdateOdometer,
}) {
  const known = items.filter((i) => TRACKED.includes(i.status)).sort(byUrgency);
  const untracked = items.filter((i) => !TRACKED.includes(i.status));
  const [next, ...rest] = known;

  return (
    <section className="card maint" aria-labelledby="maint-title">
      <div className="card__header">
        <div>
          <h2 id="maint-title" className="card__title">
            {t("Maintenance")}
          </h2>
          <p className="card__subtitle">{t("What is due next, by category")}</p>
        </div>
        {carId && (
          <Button as={Link} to={`/car/${carId}/add-record`} size="sm" variant="ghost">
            <Icon name="plus" size={14} /> {t("Log service")}
          </Button>
        )}
      </div>

      {known.length === 0 ? (
        <p className="muted">
          {t("Nothing tracked yet. Log a service (oil, filters, brakes, tires, battery) and the next due date appears here.")}
        </p>
      ) : (
        <>
          <div className={`maint-next maint-next--${next.status}`}>
            <div className="maint-next__icon" aria-hidden="true">
              <Icon name={treatmentInfo(next.part).icon} size={22} />
            </div>
            <div className="maint-next__main">
              <p className="maint-next__eyebrow">{next.status === "overdue" ? t("Needs attention") : t("Next up")}</p>
              <div className="maint-next__row">
                <h3 className="maint-next__title">{itemLabel(next)}</h3>
                <StatusPill status={next.status} />
              </div>
              <p className="maint-next__when num">{dueText(next) || whenText(next) || t("On schedule")}</p>
              <div
                className={`progress progress--${next.status}`}
                role="progressbar"
                aria-label={t("{name} interval used", { name: itemLabel(next) })}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={pct(next)}
              >
                <div className="progress__bar" style={{ width: `${pct(next)}%` }} />
              </div>
              {whenText(next) && dueText(next) && <p className="muted small num">{whenText(next)}</p>}
            </div>
          </div>

          {rest.length > 0 && (
            <ul className="maint-compact">
              {rest.map((item) => (
                <li key={item.part} className="maint-compact__row">
                  <span className="maint-compact__icon" aria-hidden="true">
                    <Icon name={treatmentInfo(item.part).icon} size={16} />
                  </span>
                  <span className="maint-compact__text">
                    <span className="maint-compact__label">{itemLabel(item)}</span>
                    <span className="maint-compact__when num">{dueText(item) || whenText(item) || t("On schedule")}</span>
                  </span>
                  <StatusPill status={item.status} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {untracked.length > 0 && known.length > 0 && (
        <p className="maint-untracked small">
          <span className="muted">{t("No history yet:")}</span> {untracked.map((i) => itemLabel(i)).join(t(", "))}
        </p>
      )}

      <CoverageNote status={status} coverage={coverage} />

      {odometer && odometer.odometer_km == null && known.length > 0 && onUpdateOdometer && (
        <p className="muted small">
          {t("Mileage-based reminders need an odometer reading.")}{" "}
          <button type="button" className="link-button" onClick={onUpdateOdometer}>
            {t("Set odometer")}
          </button>
        </p>
      )}
    </section>
  );
}

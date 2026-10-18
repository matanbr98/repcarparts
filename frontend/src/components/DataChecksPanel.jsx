import { Link } from "react-router-dom";
import Icon from "./ui/Icon";

/**
 * Non-blocking data-quality hints about a vehicle's history (odometer going backwards, same-day
 * mismatches, future dates, duplicates...). Nothing here prevents saving: it just points at entries
 * that are worth a second look.
 */
export default function DataChecksPanel({ carId, warnings = [] }) {
  if (warnings.length === 0) return null;
  return (
    <section className="card data-checks" aria-labelledby="data-checks-title">
      <h2 id="data-checks-title" className="card__title">
        <Icon name="alert" size={16} /> Worth a second look
      </h2>
      <p className="muted small">
        These entries look unusual. They are still saved and counted, so ignore this if the data is correct.
      </p>
      <ul className="data-checks__list">
        {warnings.map((w, i) => {
          const target = (w.record_ids || [])[0];
          return (
            <li key={`${w.code}-${i}`} className="data-checks__item">
              <span>{w.message}</span>
              {target != null && (
                <Link to={`/car/${carId}/edit-record/${target}`} className="data-checks__link">
                  Review entry
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

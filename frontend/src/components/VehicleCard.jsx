import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import StatusPill from "./ui/StatusPill";
import Button from "./ui/Button";
import { formatDate, formatKm, formatMoney, vehicleSubtitle, vehicleTitle } from "../lib/format";
import { statusMeta, treatmentLabel } from "../lib/treatments";

function urgencyLabel(car) {
  const status = car.status || "unknown";
  const item = car.most_urgent;
  const cov = car.coverage;
  if (status === "ok") return "Healthy";
  if (status === "unknown") {
    if (!cov || cov.known === 0) return "No service history yet";
    return `Not enough data (${cov.known} of ${cov.tracked} tracked)`;
  }
  if (!item) return statusMeta(status).label;
  const name = item.label || treatmentLabel(item.item || item.part);
  return `${name} ${statusMeta(item.status || status).label.toLowerCase()}`;
}

export default function VehicleCard({ car }) {
  return (
    <article className="card card--interactive vehicle-card" aria-label={vehicleTitle(car)}>
      <div className="vehicle-card__head">
        <div className="vehicle-card__avatar" aria-hidden="true">
          <Icon name="car" size={24} />
        </div>
        <div className="vehicle-card__titles">
          <h2>
            <Link to={`/car/${car.id}`} className="vehicle-card__link">
              {vehicleTitle(car)}
            </Link>
          </h2>
          <p className="muted small">{vehicleSubtitle(car) || "No details yet"}</p>
        </div>
        {car.license_plate && <span className="plate">{car.license_plate}</span>}
      </div>

      <StatusPill status={car.status || "unknown"} label={urgencyLabel(car)} />

      <dl className="vehicle-card__stats">
        <div>
          <dt>Odometer</dt>
          <dd className="num">{formatKm(car.odometer_km)}</dd>
        </div>
        <div>
          <dt>Total spend</dt>
          <dd className="num">{formatMoney(car.total_cost ?? 0)}</dd>
        </div>
        <div>
          <dt>Last service</dt>
          <dd>{car.last_service_date ? formatDate(car.last_service_date) : "Never"}</dd>
        </div>
      </dl>

      <div className="cluster vehicle-card__actions">
        <Button as={Link} to={`/car/${car.id}/add-record`} variant="primary">
          <Icon name="plus" size={16} /> Log service
        </Button>
        <Button as={Link} to={`/car/${car.id}`} variant="ghost">
          View
        </Button>
      </div>
    </article>
  );
}

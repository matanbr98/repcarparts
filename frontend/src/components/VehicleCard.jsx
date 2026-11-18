import { Link } from "react-router-dom";
import Icon from "./ui/Icon";
import StatusPill from "./ui/StatusPill";
import Button from "./ui/Button";
import { formatDate, formatKm, formatMoney, vehicleSubtitle, vehicleTitle } from "../lib/format";
import { urgencyLabel } from "../lib/vehicles";

export default function VehicleCard({ car }) {
  const status = car.status || "unknown";
  return (
    <article className={`card card--interactive vehicle-card vehicle-card--${status}`} aria-label={vehicleTitle(car)}>
      <div className="vehicle-card__head">
        <div className={`icon-tile icon-tile--${status === "unknown" ? "info" : status}`} aria-hidden="true">
          <Icon name="car" size={20} />
        </div>
        <div className="vehicle-card__titles">
          <h2>
            <Link to={`/car/${car.id}`} className="vehicle-card__link">
              {vehicleTitle(car)}
            </Link>
          </h2>
          <p className="muted small truncate">{vehicleSubtitle(car) || "No details yet"}</p>
        </div>
        {car.license_plate && <span className="plate">{car.license_plate}</span>}
      </div>

      <StatusPill status={status} label={urgencyLabel(car)} />

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

      <div className="vehicle-card__actions">
        <Button as={Link} to={`/car/${car.id}/add-record`} variant="secondary" size="sm">
          <Icon name="plus" size={14} /> Log service
        </Button>
        <Button as={Link} to={`/car/${car.id}`} variant="ghost" size="sm" aria-label={`View ${vehicleTitle(car)}`}>
          View details <Icon name="arrow-right" size={14} />
        </Button>
      </div>
    </article>
  );
}

import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Skeleton, { SkeletonCard } from "../components/ui/Skeleton";
import VehicleCard from "../components/VehicleCard";
import { formatMoney, formatNumber } from "../lib/format";

function SummaryStrip({ summary }) {
  const items = [
    { label: "Vehicles", value: formatNumber(summary.cars), icon: "car" },
    { label: "Services this year", value: formatNumber(summary.services_this_year), icon: "wrench" },
    { label: "Spend this year", value: formatMoney(summary.spend_this_year), icon: "coins" },
    { label: "Total spend", value: formatMoney(summary.spend_total), icon: "coins" },
  ];
  return (
    <dl className="summary-strip">
      {items.map((i) => (
        <div key={i.label} className="summary-strip__item">
          <dt className="muted small">{i.label}</dt>
          <dd className="num">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function Garage() {
  const { data, error, loading, reload } = useAsync(() => api.garage(), []);

  const cars = data?.cars || [];

  return (
    <div className="stack-lg">
      <PageHeader
        title="My garage"
        subtitle="Every vehicle, its status and what is due next."
        actions={
          <Button as={Link} to="/add-car" variant="secondary">
            <Icon name="plus" size={16} /> Add vehicle
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState error={error} title="Could not load your garage" onRetry={reload} />
      ) : loading && !data ? (
        <div className="stack-lg" role="status" aria-label="Loading garage">
          <Skeleton height={72} radius={12} />
          <div className="vehicle-grid">
            <SkeletonCard lines={4} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      ) : cars.length === 0 ? (
        <EmptyState
          icon="car"
          title="Your garage is empty"
          text="Add your first vehicle to start tracking services, costs and what is due next."
        >
          <Button as={Link} to="/add-car" variant="primary" size="lg">
            <Icon name="plus" size={16} /> Add your first vehicle
          </Button>
        </EmptyState>
      ) : (
        <>
          {data.summary && <SummaryStrip summary={data.summary} />}
          <div className="vehicle-grid">
            {cars.map((car) => (
              <VehicleCard key={car.id} car={car} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

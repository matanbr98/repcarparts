import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useAuth } from "../hooks/useAuth";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import StatCard from "../components/ui/StatCard";
import Segmented from "../components/ui/Segmented";
import StatusPill from "../components/ui/StatusPill";
import { Input } from "../components/ui/Field";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import Skeleton, { SkeletonCard } from "../components/ui/Skeleton";
import VehicleCard from "../components/VehicleCard";
import { urgencyLabel } from "../lib/vehicles";
import { formatDate, formatMoney, formatNumber, relativeDay, todayISO, vehicleTitle } from "../lib/format";

const ATTENTION = ["overdue", "due_soon"];
const URGENCY = { overdue: 0, due_soon: 1 };

function matches(car, q) {
  if (!q) return true;
  const hay = [car.nickname, car.make, car.model, car.year, car.license_plate].filter(Boolean).join(" ").toLowerCase();
  return hay.includes(q);
}

function filterByStatus(car, f) {
  const s = car.status || "unknown";
  if (f === "attention") return ATTENTION.includes(s);
  if (f === "ok") return s === "ok";
  if (f === "unknown") return s === "unknown";
  return true;
}

function KpiRow({ summary, attentionCount }) {
  const year = new Date().getFullYear();
  return (
    <div className="grid-4">
      <StatCard
        label="Vehicles"
        value={formatNumber(summary.cars)}
        icon="car"
        tone="info"
        hint={attentionCount > 0 ? `${attentionCount} need${attentionCount === 1 ? "s" : ""} attention` : "All on schedule or untracked"}
      />
      <StatCard label="Services this year" value={formatNumber(summary.services_this_year)} icon="wrench" hint={`Logged in ${year}`} />
      <StatCard label="Spend this year" value={formatMoney(summary.spend_this_year)} icon="coins" tone="accent" hint={`Since 1 Jan ${year}`} />
      <StatCard label="Total spend" value={formatMoney(summary.spend_total)} icon="chart" hint="All time, all vehicles" />
    </div>
  );
}

function AttentionCard({ cars }) {
  const list = cars
    .filter((c) => ATTENTION.includes(c.status))
    .sort((a, b) => (URGENCY[a.status] ?? 9) - (URGENCY[b.status] ?? 9));
  const untracked = cars.filter((c) => (c.status || "unknown") === "unknown").length;

  return (
    <section className="card card--flush dash-card" aria-labelledby="attention-title">
      <div className="card__header">
        <div>
          <h2 id="attention-title" className="card__title">
            Needs attention
          </h2>
          <p className="card__subtitle">Vehicles with maintenance due soon or overdue</p>
        </div>
        {list.length > 0 && <span className="badge badge--overdue num">{list.length}</span>}
      </div>
      {list.length === 0 ? (
        <EmptyState
          compact
          icon="check-circle"
          title="Nothing due right now"
          text={
            untracked > 0
              ? `${untracked} vehicle${untracked === 1 ? " has" : "s have"} too little history to judge. Log services to start tracking.`
              : "Every tracked vehicle is on schedule."
          }
        />
      ) : (
        <ul className="row-list">
          {list.slice(0, 6).map((c) => (
            <li key={c.id}>
              <Link to={`/car/${c.id}`} className="row-link">
                <span className={`icon-tile icon-tile--sm icon-tile--${c.status}`} aria-hidden="true">
                  <Icon name={c.status === "overdue" ? "alert" : "clock"} size={16} />
                </span>
                <span className="row-link__main">
                  <span className="row-link__title truncate">{vehicleTitle(c)}</span>
                  <span className="row-link__sub truncate">{urgencyLabel(c)}</span>
                </span>
                <StatusPill status={c.status} className="row-link__pill" />
                <Icon name="chevron-right" size={16} className="row-link__chev" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function RemindersCard({ state }) {
  const { data, error, loading } = state;
  const today = todayISO();
  const open = (data || [])
    .filter((r) => !r.done)
    .sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")));

  return (
    <section className="card card--flush dash-card" aria-labelledby="reminders-title">
      <div className="card__header">
        <div>
          <h2 id="reminders-title" className="card__title">
            Upcoming reminders
          </h2>
          <p className="card__subtitle">Open reminders, soonest first</p>
        </div>
        <Button as={Link} to="/reminders" variant="ghost" size="sm">
          View all <Icon name="arrow-right" size={14} />
        </Button>
      </div>
      {loading && !data ? (
        <div className="stack-sm dash-card__pad" role="status" aria-label="Loading reminders">
          <Skeleton height={36} />
          <Skeleton height={36} />
        </div>
      ) : error && !data ? (
        <p className="muted small dash-card__pad">Reminders could not be loaded.</p>
      ) : open.length === 0 ? (
        <EmptyState compact icon="bell" title="You're all caught up" text="No open reminders." />
      ) : (
        <ul className="row-list">
          {open.slice(0, 5).map((r) => {
            const overdue = r.due_date && r.due_date < today;
            return (
              <li key={r.id}>
                <Link to="/reminders" className="row-link">
                  <span className={`icon-tile icon-tile--sm${overdue ? " icon-tile--overdue" : ""}`} aria-hidden="true">
                    <Icon name="bell" size={16} />
                  </span>
                  <span className="row-link__main">
                    <span className="row-link__title truncate">{r.title}</span>
                    <span className="row-link__sub truncate">
                      {[r.car_label, r.source === "self" ? "My reminder" : "From manager"].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {r.due_date ? (
                    <span className={`row-link__date${overdue ? " row-link__date--overdue" : ""}`} title={formatDate(r.due_date)}>
                      {overdue ? "Overdue" : relativeDay(r.due_date, today)}
                    </span>
                  ) : (
                    <span className="row-link__date">No date</span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default function Garage() {
  const { isManager } = useAuth();
  const { data, error, loading, reload } = useAsync(() => api.garage(), []);
  const reminders = useAsync(() => api.myReminders(), []);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const cars = useMemo(() => data?.cars || [], [data]);
  const query = q.trim().toLowerCase();
  const counts = useMemo(
    () => ({
      all: cars.length,
      attention: cars.filter((c) => filterByStatus(c, "attention")).length,
      ok: cars.filter((c) => filterByStatus(c, "ok")).length,
      unknown: cars.filter((c) => filterByStatus(c, "unknown")).length,
    }),
    [cars]
  );
  const visible = cars.filter((c) => filterByStatus(c, filter) && matches(c, query));

  return (
    <div className="stack-lg">
      <PageHeader
        title="Garage"
        subtitle={isManager ? "Every vehicle in the fleet, its status and what is due next." : "Your vehicles, their status and what is due next."}
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
          <div className="grid-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={104} radius={14} />
            ))}
          </div>
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
          <Button as={Link} to="/add-car" variant="accent" size="lg">
            <Icon name="plus" size={16} /> Add your first vehicle
          </Button>
        </EmptyState>
      ) : (
        <>
          {data.summary && <KpiRow summary={data.summary} attentionCount={counts.attention} />}

          <div className="dash-grid">
            <AttentionCard cars={cars} />
            <RemindersCard state={reminders} />
          </div>

          <section className="stack" aria-labelledby="vehicles-title">
            <div className="section-head">
              <h2 id="vehicles-title" className="section-head__title">
                Vehicles <span className="section-head__count num">{cars.length}</span>
              </h2>
            </div>
            <div className="toolbar">
              <Input
                label="Search vehicles"
                hideLabel
                icon="search"
                type="search"
                placeholder="Search by name, make, model or plate"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                fieldClassName="toolbar__search"
              />
              <Segmented
                label="Filter by status"
                value={filter}
                onChange={setFilter}
                options={[
                  { value: "all", label: "All", count: counts.all },
                  { value: "attention", label: "Needs attention", count: counts.attention },
                  { value: "ok", label: "Healthy", count: counts.ok },
                  { value: "unknown", label: "No data", count: counts.unknown },
                ]}
              />
            </div>

            {visible.length === 0 ? (
              <EmptyState icon="search" title="No vehicles match" text="Try a different search or status filter.">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setFilter("all");
                  }}
                >
                  Clear filters
                </Button>
              </EmptyState>
            ) : (
              <div className="vehicle-grid">
                {visible.map((car) => (
                  <VehicleCard key={car.id} car={car} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

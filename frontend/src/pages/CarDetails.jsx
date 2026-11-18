import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api, downloadBlob } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/ui/toastContext";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Tabs from "../components/ui/Tabs";
import StatusPill from "../components/ui/StatusPill";
import StatCard from "../components/ui/StatCard";
import Menu, { MenuItem, MenuSeparator } from "../components/ui/Menu";
import { Input, Select } from "../components/ui/Field";
import { ConfirmDialog } from "../components/ui/Modal";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Skeleton, { SkeletonCard } from "../components/ui/Skeleton";
import MaintenanceStatusPanel from "../components/MaintenanceStatusPanel";
import OdometerModal from "../components/OdometerModal";
import ServiceTimeline from "../components/ServiceTimeline";
import DataChecksPanel from "../components/DataChecksPanel";
import ReceiptLightbox from "../components/ReceiptLightbox";
import SpendChart from "../components/SpendChart";
import { TREATMENTS, displayTitle, itemLabel, treatmentLabel } from "../lib/treatments";
import { exportBaseName, formatDate, formatKm, formatMoney, formatNumber, vehicleSubtitle, vehicleTitle } from "../lib/format";
import { t, tp } from "../i18n";
import { warningMessage } from "../lib/warnings";

function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function yearOptions(minYear, selected) {
  const now = new Date().getFullYear();
  const sel = Number(selected) || now;
  const from = Math.min(now - 3, minYear || now, sel);
  const out = [];
  for (let y = Math.max(now, sel); y >= from; y--) out.push(String(y));
  return out;
}

function ExpensesTab({ carId }) {
  const [year, setYear] = useState("");
  const { data, error, loading, reload } = useAsync(() => api.expenses(carId, year), [carId, year]);
  // learn the oldest year from the unfiltered ("All time") response so older years stay selectable
  const [firstYear, setFirstYear] = useState();
  const seenYear =
    !year && data?.by_month?.length
      ? Math.min(...data.by_month.map((m) => Number(String(m.month).slice(0, 4))).filter(Boolean))
      : undefined;
  if (seenYear !== undefined && Number.isFinite(seenYear) && seenYear !== firstYear) setFirstYear(seenYear);
  const years = yearOptions(firstYear, year);

  const maxType = Math.max(1, ...(data?.by_type || []).map((row) => row.total || 0));

  return (
    <div className="stack-lg" role="tabpanel" id="panel-expenses" aria-labelledby="tab-expenses">
      <div className="spread">
        <div>
          <h2 className="section-head__title">{t("Expenses")}</h2>
          <p className="muted small">{t("What this vehicle has cost, by service type and month.")}</p>
        </div>
        <Select label={t("Period")} hideLabel value={year} onChange={(e) => setYear(e.target.value)} fieldClassName="period-select">
          <option value="">{t("All time")}</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      </div>

      {loading && !data && <SkeletonCard lines={4} />}
      {error && <ErrorState error={error} onRetry={reload} />}
      {data && !error && (
        <>
          <div className="grid-3">
            <StatCard label={t("Total spend")} value={formatMoney(data.total)} icon="coins" tone="accent" hint={year ? t("In {year}", { year }) : t("All time")} />
            <StatCard label={year ? t("Spend in {year}", { year }) : t("This year")} value={formatMoney(data.year_total)} icon="calendar" />
            <StatCard label={t("Services")} value={formatNumber(data.records_count)} icon="wrench" hint={year ? t("Logged in {year}", { year }) : t("Logged in total")} />
          </div>

          {data.records_count === 0 ? (
            <EmptyState
              icon="coins"
              title={year ? t("No services in {year}", { year }) : t("No expenses yet")}
              text={year ? t("Pick another period to see costs.") : t("Costs show up here once you log services with a price.")}
            />
          ) : (
            <>
              <section className="card">
                <div className="card__header">
                  <h2 className="card__title">{t("By service type")}</h2>
                  <span className="muted small">{t("Total (services)")}</span>
                </div>
                <ul className="bars">
                  {(data.by_type || []).map((row) => (
                    <li key={row.treatment_type} className="bars__row">
                      <span className="bars__label">
                        {row.treatment_type ? treatmentLabel(row.treatment_type) : displayTitle(row.label)}
                      </span>
                      <span className="bars__track" aria-hidden="true">
                        <span className="bars__fill" style={{ width: `${Math.round(((row.total || 0) / maxType) * 100)}%` }} />
                      </span>
                      <span className="bars__value num">
                        {formatMoney(row.total)} <span className="muted small">({row.count})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              {(data.by_month || []).length > 0 && (
                <section className="card">
                  <div className="card__header">
                    <h2 className="card__title">{t("Spend by month")}</h2>
                  </div>
                  <SpendChart data={data.by_month} />
                </section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

export default function CarDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();

  const [tab, setTab] = useState("history");
  const [q, setQ] = useState("");
  const [type, setType] = useState("");
  const [year, setYear] = useState("");
  const debouncedQ = useDebounced(q);
  const [receipt, setReceipt] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmCar, setConfirmCar] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filters = useMemo(() => ({ q: debouncedQ.trim(), type, year }), [debouncedQ, type, year]);
  const filtersActive = !!(filters.q || filters.type || filters.year);

  const car = useAsync(() => api.getCar(id), [id]);
  const due = useAsync(() => api.maintenanceDue(id), [id]);
  const overview = useAsync(() => api.carOverview(id), [id]);
  const [odoOpen, setOdoOpen] = useState(false);
  const cost = useAsync(() => api.carCostSummary(id), [id]);
  const records = useAsync(() => api.getRecords(id, filters), [id, filters]);

  const [knownMinYear, setKnownMinYear] = useState();
  useEffect(() => {
    // only learn from unfiltered results, otherwise a narrow filter would shrink the year list
    if (filtersActive || !records.data) return;
    const ys = records.data.map((r) => Number(String(r.service_date).slice(0, 4))).filter(Boolean);
    if (ys.length) setKnownMinYear(Math.min(...ys));
  }, [records.data, filtersActive]);
  const minYear = knownMinYear;

  async function confirmDeleteRecord() {
    setDeleting(true);
    try {
      await api.deleteRecord(id, toDelete.id);
      records.setData((prev) => (prev || []).filter((r) => r.id !== toDelete.id));
      toast.success(t("Service deleted"));
      setToDelete(null);
      due.reload();
      cost.reload();
      overview.reload();
    } catch (e) {
      toast.error(e.message || t("Could not delete the service."));
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDeleteCar() {
    setDeleting(true);
    try {
      await api.deleteCar(id);
      toast.success(t("Vehicle deleted"));
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e.message || t("Could not delete the vehicle."));
      setDeleting(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    try {
      const blob = await api.exportRecordsCsv(id, filters);
      const base = exportBaseName(car.data, id);
      downloadBlob(blob, `${base}-service-history.csv`);
    } catch (e) {
      toast.error(e.message || t("Export failed."));
    } finally {
      setExporting(false);
    }
  }

  if (car.loading && !car.data) {
    return (
      <div className="stack-lg" role="status" aria-label={t("Loading vehicle")}>
        <Skeleton width="40%" height={32} />
        <SkeletonCard />
        <SkeletonCard lines={5} />
      </div>
    );
  }
  if (car.error) {
    return (
      <div className="stack">
        <Link to="/" className="page-header__back">
          <Icon name="back" size={16} className="icon--dir" /> {t("Garage")}
        </Link>
        <ErrorState
          error={car.error}
          title={car.error.status === 404 ? t("Vehicle not found") : t("Could not load this vehicle")}
          onRetry={car.error.status === 404 ? undefined : car.reload}
        />
      </div>
    );
  }

  const c = car.data;
  const status = overview.data?.status || "unknown";
  const odo = overview.data?.odometer;
  const coverage = overview.data?.coverage;
  const list = records.data || [];
  const flaggedIds = new Set((overview.data?.warnings || []).flatMap((w) => w.record_ids || []));

  const urgent = (due.data || [])
    .filter((i) => i.status === "overdue" || i.status === "due_soon")
    .sort((a, b) => (a.status === "overdue" ? 0 : 1) - (b.status === "overdue" ? 0 : 1))[0];
  const clearFilters = () => {
    setQ("");
    setType("");
    setYear("");
  };

  return (
    <div className="stack-lg">
      <PageHeader
        back={{ to: "/", label: t("Garage") }}
        leading={
          <span className={`icon-tile icon-tile--lg icon-tile--${status === "unknown" ? "info" : status}`} aria-hidden="true">
            <Icon name="car" size={24} />
          </span>
        }
        title={vehicleTitle(c)}
        subtitle={vehicleSubtitle(c) || undefined}
        meta={
          <>
            {c.license_plate && <span className="plate">{c.license_plate}</span>}
            {overview.data ? (
              <StatusPill status={status} />
            ) : overview.loading ? (
              <Skeleton width={96} height={22} radius={999} />
            ) : null}
          </>
        }
        actions={
          <>
            <Button as={Link} to={`/car/${id}/add-record`} variant="accent">
              <Icon name="plus" size={16} /> {t("Log service")}
            </Button>
            <Button as={Link} to={`/car/${id}/edit`} variant="secondary">
              <Icon name="edit" size={16} /> {t("Edit")}
            </Button>
            <Menu
              label={t("More vehicle actions")}
              tooltip={t("More actions")}
              triggerClassName="btn btn--secondary btn--icon"
              trigger={<Icon name="more" size={18} />}
            >
              <MenuItem icon="gauge" onSelect={() => setOdoOpen(true)}>
                {t("Update odometer")}
              </MenuItem>
              <MenuItem icon="download" onSelect={exportCsv}>
                {t("Export history (CSV)")}
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon="trash" danger onSelect={() => setConfirmCar(true)}>
                {t("Delete vehicle")}
              </MenuItem>
            </Menu>
          </>
        }
      />

      <div className="grid-4">
        <StatCard
          label={t("Odometer")}
          icon="gauge"
          tone="info"
          value={odo?.odometer_km != null ? formatKm(odo.odometer_km) : overview.loading ? "..." : t("Not set")}
          action={
            overview.data && (
              <button type="button" className="link-button" onClick={() => setOdoOpen(true)}>
                {odo?.odometer_km != null ? t("Update reading") : t("Set odometer")}
              </button>
            )
          }
        />
        <StatCard
          label={t("Total spend")}
          icon="coins"
          tone="accent"
          value={cost.data ? formatMoney(cost.data.total_cost) : cost.loading ? "..." : "-"}
          hint={t("All services, all time")}
        />
        <StatCard
          label={t("Next due")}
          icon={urgent ? (urgent.status === "overdue" ? "alert" : "clock") : "check-circle"}
          tone={urgent ? (urgent.status === "overdue" ? "danger" : "warn") : "ok"}
          value={urgent ? itemLabel(urgent) : due.loading ? "..." : t("Nothing due")}
          hint={
            urgent
              ? urgent.due_date
                ? urgent.status === "overdue"
                  ? t("Was due {date}", { date: formatDate(urgent.due_date) })
                  : t("Due {date}", { date: formatDate(urgent.due_date) })
                : urgent.status === "overdue"
                  ? t("Overdue")
                  : t("Due soon")
              : t("Based on logged services")
          }
        />
        <StatCard
          label={t("Tracking coverage")}
          icon="activity"
          value={coverage ? <span dir="ltr">{`${coverage.known} / ${coverage.tracked}`}</span> : overview.loading ? "..." : "-"}
          hint={t("Maintenance categories with history")}
        />
      </div>

      {overview.error && !overview.data && (
        <ErrorState error={overview.error} title={t("Could not load the vehicle status")} onRetry={overview.reload} />
      )}

      <div className="detail-layout">
        <aside className="detail-layout__aside stack-lg" aria-label={t("Vehicle status")}>
          {(overview.data?.warnings || []).length > 0 && <DataChecksPanel carId={id} warnings={overview.data.warnings} />}

          {due.error ? (
            <ErrorState error={due.error} title={t("Could not load maintenance status")} onRetry={due.reload} />
          ) : due.loading && !due.data ? (
            <SkeletonCard lines={4} />
          ) : (
            <MaintenanceStatusPanel
              items={due.data || []}
              carId={id}
              status={status}
              coverage={coverage}
              odometer={odo}
              onUpdateOdometer={() => setOdoOpen(true)}
            />
          )}
        </aside>

        <div className="detail-layout__main stack-lg">
          <Tabs
            tabs={[
              { id: "history", label: t("Service history"), count: records.data && !filtersActive ? list.length : undefined },
              { id: "expenses", label: t("Expenses") },
            ]}
            value={tab}
            onChange={setTab}
            label={t("Vehicle sections")}
          />

          {tab === "expenses" ? (
            <ExpensesTab carId={id} />
          ) : (
            <div className="stack" role="tabpanel" id="panel-history" aria-labelledby="tab-history">
              <div className="filters">
                <Input
                  label={t("Search services")}
                  hideLabel
                  icon="search"
                  type="search"
                  placeholder={t("Search title, notes or parts")}
                  maxLength={100}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Select label={t("Service type")} hideLabel value={type} onChange={(e) => setType(e.target.value)}>
                  <option value="">{t("All types")}</option>
                  {TREATMENTS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(opt.label)}
                    </option>
                  ))}
                </Select>
                <Select label={t("Year")} hideLabel value={year} onChange={(e) => setYear(e.target.value)}>
                  <option value="">{t("All years")}</option>
                  {yearOptions(minYear, year).map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </Select>
                <Button variant="secondary" onClick={exportCsv} loading={exporting} className="filters__export">
                  <Icon name="download" size={16} /> {t("Export CSV")}
                </Button>
              </div>

              {filtersActive && records.data && (
                <div className="filters__summary">
                  <span className="muted small">
                    {tp(list.length, "1 matching service", "{n} matching services")}
                  </span>
                  <button type="button" className="link-button small" onClick={clearFilters}>
                    {t("Clear filters")}
                  </button>
                </div>
              )}

              {records.error ? (
                <ErrorState error={records.error} title={t("Could not load service history")} onRetry={records.reload} />
              ) : records.loading && !records.data ? (
                <div className="stack" role="status" aria-label={t("Loading service history")}>
                  <SkeletonCard />
                  <SkeletonCard />
                </div>
              ) : list.length === 0 ? (
                filtersActive ? (
                  <EmptyState icon="search" title={t("No matching services")} text={t("Try a different search or clear the filters.")}>
                    <Button variant="secondary" onClick={clearFilters}>
                      {t("Clear filters")}
                    </Button>
                  </EmptyState>
                ) : (
                  <EmptyState icon="wrench" title={t("No services logged yet")} text={t("Log the first service to build this vehicle's history.")}>
                    <Button as={Link} to={`/car/${id}/add-record`} variant="accent">
                      <Icon name="plus" size={16} /> {t("Log service")}
                    </Button>
                  </EmptyState>
                )
              ) : (
                <ServiceTimeline
                  carId={id}
                  records={list}
                  flaggedIds={flaggedIds}
                  onDelete={setToDelete}
                  onOpenReceipt={setReceipt}
                />
              )}
            </div>
          )}
        </div>
      </div>

      <OdometerModal
        open={odoOpen}
        carId={id}
        odometer={odo}
        onClose={() => setOdoOpen(false)}
        onSaved={(res) => {
          setOdoOpen(false);
          (res?.warnings || []).forEach((w) => toast.info(warningMessage(w)));
          overview.reload();
          due.reload();
        }}
      />

      <ReceiptLightbox imageUrl={receipt?.image_url} title={receipt?.title} onClose={() => setReceipt(null)} />

      <ConfirmDialog
        open={!!toDelete}
        title={t("Delete this service?")}
        message={toDelete ? t("\"{title}\" will be permanently removed from the history.", { title: displayTitle(toDelete.title) }) : ""}
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDeleteRecord}
      />
      <ConfirmDialog
        open={confirmCar}
        title={t("Delete this vehicle?")}
        message={t("The vehicle and all of its service history will be permanently removed.")}
        busy={deleting}
        onCancel={() => setConfirmCar(false)}
        onConfirm={confirmDeleteCar}
      />
    </div>
  );
}

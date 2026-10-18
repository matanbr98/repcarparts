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
import { TREATMENTS, treatmentLabel } from "../lib/treatments";
import { exportBaseName, formatKm, formatMoney, formatNumber, vehicleSubtitle, vehicleTitle } from "../lib/format";

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

  const maxType = Math.max(1, ...(data?.by_type || []).map((t) => t.total || 0));

  return (
    <div className="stack-lg" role="tabpanel" id="panel-expenses" aria-labelledby="tab-expenses">
      <div className="cluster">
        <Select label="Period" value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All time</option>
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
            <div className="card stat">
              <span className="muted small">Total spend</span>
              <strong className="stat__value num">{formatMoney(data.total)}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">{year ? `Spend in ${year}` : "This year"}</span>
              <strong className="stat__value num">{formatMoney(data.year_total)}</strong>
            </div>
            <div className="card stat">
              <span className="muted small">Services</span>
              <strong className="stat__value num">{formatNumber(data.records_count)}</strong>
            </div>
          </div>

          {data.records_count === 0 ? (
            <EmptyState
              icon="coins"
              title={year ? `No services in ${year}` : "No expenses yet"}
              text={year ? "Pick another period to see costs." : "Costs show up here once you log services with a price."}
            />
          ) : (
            <>
              <section className="card">
                <h2 className="card__title">By service type</h2>
                <ul className="bars">
                  {(data.by_type || []).map((t) => (
                    <li key={t.treatment_type} className="bars__row">
                      <span className="bars__label">{t.label || treatmentLabel(t.treatment_type)}</span>
                      <span className="bars__track" aria-hidden="true">
                        <span className="bars__fill" style={{ width: `${Math.round(((t.total || 0) / maxType) * 100)}%` }} />
                      </span>
                      <span className="bars__value num">
                        {formatMoney(t.total)} <span className="muted small">({t.count})</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              {(data.by_month || []).length > 0 && (
                <section className="card">
                  <h2 className="card__title">Spend by month</h2>
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
      toast.success("Service deleted");
      setToDelete(null);
      due.reload();
      cost.reload();
      overview.reload();
    } catch (e) {
      toast.error(e.message || "Could not delete the service.");
    } finally {
      setDeleting(false);
    }
  }

  async function confirmDeleteCar() {
    setDeleting(true);
    try {
      await api.deleteCar(id);
      toast.success("Vehicle deleted");
      navigate("/", { replace: true });
    } catch (e) {
      toast.error(e.message || "Could not delete the vehicle.");
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
      toast.error(e.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  if (car.loading && !car.data) {
    return (
      <div className="stack-lg" role="status" aria-label="Loading vehicle">
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
          <Icon name="back" size={16} /> Garage
        </Link>
        <ErrorState
          error={car.error}
          title={car.error.status === 404 ? "Vehicle not found" : "Could not load this vehicle"}
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

  return (
    <div className="stack-lg">
      <PageHeader
        back={{ to: "/", label: "Garage" }}
        title={vehicleTitle(c)}
        subtitle={[vehicleSubtitle(c), c.license_plate].filter(Boolean).join(" - ")}
        actions={
          <>
            <Button as={Link} to={`/car/${id}/add-record`} variant="primary">
              <Icon name="plus" size={16} /> Log service
            </Button>
            <Button as={Link} to={`/car/${id}/edit`} variant="secondary">
              <Icon name="edit" size={16} /> Edit
            </Button>
            <Button variant="danger-ghost" onClick={() => setConfirmCar(true)}>
              <Icon name="trash" size={16} /> Delete
            </Button>
          </>
        }
      />

      <div className="cluster">
        {overview.data ? (
          <StatusPill status={status} />
        ) : overview.loading ? (
          <Skeleton width={96} height={24} radius={999} />
        ) : null}
        {overview.data && (
          <button type="button" className="badge badge--button num" onClick={() => setOdoOpen(true)} title="Update odometer">
            <Icon name="gauge" size={14} /> {odo?.odometer_km != null ? formatKm(odo.odometer_km) : "Set odometer"}
            <span className="badge__action">Update</span>
          </button>
        )}
        {cost.data && (
          <span className="badge badge--teal num">
            <Icon name="coins" size={14} /> {formatMoney(cost.data.total_cost)} total
          </span>
        )}
      </div>

      {overview.error && !overview.data && (
        <ErrorState error={overview.error} title="Could not load the vehicle status" onRetry={overview.reload} />
      )}

      {(overview.data?.warnings || []).length > 0 && <DataChecksPanel carId={id} warnings={overview.data.warnings} />}

      {due.error ? (
        <ErrorState error={due.error} title="Could not load maintenance status" onRetry={due.reload} />
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

      <Tabs
        tabs={[
          { id: "history", label: "Service history" },
          { id: "expenses", label: "Expenses" },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === "expenses" ? (
        <ExpensesTab carId={id} />
      ) : (
        <div className="stack" role="tabpanel" id="panel-history" aria-labelledby="tab-history">
          <div className="filters">
            <Input
              label="Search"
              type="search"
              placeholder="Title, notes or parts"
              maxLength={100}
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Select label="Type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {TREATMENTS.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
            <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
              <option value="">All years</option>
              {yearOptions(minYear, year).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button variant="secondary" onClick={exportCsv} loading={exporting} className="filters__export">
              <Icon name="download" size={16} /> Export CSV
            </Button>
          </div>

          {records.error ? (
            <ErrorState error={records.error} title="Could not load service history" onRetry={records.reload} />
          ) : records.loading && !records.data ? (
            <div className="stack" role="status" aria-label="Loading service history">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : list.length === 0 ? (
            filtersActive ? (
              <EmptyState icon="search" title="No matching services" text="Try a different search or clear the filters.">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setQ("");
                    setType("");
                    setYear("");
                  }}
                >
                  Clear filters
                </Button>
              </EmptyState>
            ) : (
              <EmptyState icon="wrench" title="No services logged yet" text="Log the first service to build this vehicle's history.">
                <Button as={Link} to={`/car/${id}/add-record`} variant="primary">
                  <Icon name="plus" size={16} /> Log service
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

      <OdometerModal
        open={odoOpen}
        carId={id}
        odometer={odo}
        onClose={() => setOdoOpen(false)}
        onSaved={(res) => {
          setOdoOpen(false);
          (res?.warnings || []).forEach((w) => toast.info(w.message));
          overview.reload();
          due.reload();
        }}
      />

      <ReceiptLightbox imageUrl={receipt?.image_url} title={receipt?.title} onClose={() => setReceipt(null)} />

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this service?"
        message={toDelete ? `"${toDelete.title}" will be permanently removed from the history.` : ""}
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDeleteRecord}
      />
      <ConfirmDialog
        open={confirmCar}
        title="Delete this vehicle?"
        message="The vehicle and all of its service history will be permanently removed."
        busy={deleting}
        onCancel={() => setConfirmCar(false)}
        onConfirm={confirmDeleteCar}
      />
    </div>
  );
}

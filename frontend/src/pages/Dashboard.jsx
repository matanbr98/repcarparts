import React, { useEffect, useMemo, useState } from "react";
import { api } from "../services/api";
import { Link, useNavigate } from "react-router-dom";
import Card from "../components/Card";
import Button from "../components/Button";

export default function Dashboard() {
  const [cars, setCars] = useState([]);
  const [err, setErr] = useState("");
  const [cost, setCost] = useState(null);
  const [recordsCount, setRecordsCount] = useState(0);
  const navigate = useNavigate();

  async function refresh() {
    setErr("");
    const data = await api.getCars();
    setCars(data);
    const summary = await api.myCostSummary();
    setCost(summary);

    // MVP: compute records count by fetching each car's records
    const counts = await Promise.all(data.map((c) => api.getRecords(c.id).then((r) => r.length).catch(() => 0)));
    setRecordsCount(counts.reduce((a, b) => a + b, 0));
  }

  useEffect(() => {
    refresh().catch((e) => setErr(String(e.message || e)));
  }, []);

  const newestCarId = useMemo(() => (cars[0]?.id ? cars[0].id : null), [cars]);

  return (
    <div className="dashboard">
      <div className="dashboard__grid">
        {/* Welcome */}
        <Card className="welcome">
          <div className="welcome__content">
            <div>
              <div className="eyebrow">Welcome back</div>
              <h1 className="h1">Your garage at a glance</h1>
              <p className="subtle">
                Track maintenance, costs, and upcoming replacements — all in one place.
              </p>
            </div>
            <div className="welcome__actions">
              <Button
                variant="primary"
                onClick={() => {
                  if (newestCarId) navigate(`/car/${newestCarId}/add-record`);
                  else navigate("/add-car");
                }}
              >
                Add new record
              </Button>
              <Button as={Link} to="/reminders" variant="ghost">
                View reminders
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats */}
        <div className="stats">
          <Card className="stat">
            <div className="stat__icon">🚗</div>
            <div className="stat__value">{cars.length}</div>
            <div className="stat__label">Total Cars</div>
          </Card>
          <Card className="stat">
            <div className="stat__icon">🧰</div>
            <div className="stat__value">{recordsCount}</div>
            <div className="stat__label">Maintenance Records</div>
          </Card>
          <Card className="stat">
            <div className="stat__icon">💳</div>
            <div className="stat__value">{cost ? `${cost.total_cost}` : "—"}</div>
            <div className="stat__label">Total Cost (ILS)</div>
          </Card>
        </div>

        {/* Cars */}
        <Card className="cars">
          <div className="cars__header">
            <div>
              <h2 className="h2">Cars</h2>
              <div className="subtle">Select a car to view service history.</div>
            </div>
          </div>

          {cars.length === 0 ? (
            <div className="empty">
              <div className="empty__title">No cars yet</div>
              <div className="subtle">Add your first car to start tracking maintenance.</div>
              <div style={{ marginTop: 12 }}>
                <Button as={Link} to="/add-car" variant="primary">
                  Add Car
                </Button>
              </div>
            </div>
          ) : (
            <div className="cars__list">
              {cars.map((car) => (
                <div key={car.id} className="car-row">
                  <div className="car-row__main">
                    <div className="car-row__title">{car.nickname}</div>
                    <div className="car-row__meta">
                      {car.make} {car.model}
                      {car.year ? ` • ${car.year}` : ""}
                    </div>
                  </div>
                  <div className="car-row__right">
                    <Button as={Link} to={`/car/${car.id}`} variant="ghost">
                      Select
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {err && <p style={{ color: "#b91c1c" }}>Error: {err}</p>}
      </div>
    </div>
  );
}
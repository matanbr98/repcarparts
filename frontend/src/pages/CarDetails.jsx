import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../services/api';

export default function CarDetails() {
  const { id } = useParams();
  const [records, setRecords] = useState([]);
  const [err, setErr] = useState("");
  const [cost, setCost] = useState(null);
  const [due, setDue] = useState([]);

  useEffect(() => {
    setErr("");
    Promise.all([api.getRecords(id), api.carCostSummary(id), api.maintenanceDue(id)])
      .then(([recs, carCost, dueList]) => {
        setRecords(recs);
        setCost(carCost);
        setDue(dueList);
      })
      .catch((e) => setErr(String(e.message || e)));
  }, [id]);

  async function onDeleteRecord(recordId) {
    const ok = window.confirm("Delete this record?");
    if (!ok) return;
    setErr("");
    try {
      await api.deleteRecord(id, recordId);
      setRecords((prev) => prev.filter((r) => r.id !== recordId));
    } catch (e) {
      setErr(String(e.message || e));
    }
  }

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <Link to="/" className="btn btn--ghost">← Back</Link>
        <Link to={`/car/${id}/add-record`} className="btn btn--primary">+ Log New Service</Link>
      </div>

      <h2>Service History</h2>

      <div className="grid" style={{ marginTop: 12 }}>
        {cost && (
          <div className="card col-6">
            <div className="muted">Total spent (this car)</div>
            <div style={{ fontSize: 22, fontWeight: 750 }}>{cost.total_cost} ILS</div>
          </div>
        )}
        <div className="card col-6">
          <div className="muted">Maintenance reminders</div>
          {due?.length ? (
            <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
              {due
                .filter((d) => d.status === "overdue" || d.status === "due_soon")
                .slice(0, 6)
                .map((d) => (
                  <div key={d.part} className="row" style={{ justifyContent: "space-between" }}>
                    <b style={{ textTransform: "capitalize" }}>{d.part}</b>
                    <span className="muted">{d.status.replace("_", " ")}</span>
                  </div>
                ))}
              {due.filter((d) => d.status === "overdue" || d.status === "due_soon").length === 0 && (
                <div className="muted" style={{ marginTop: 6 }}>No urgent items</div>
              )}
            </div>
          ) : (
            <div className="muted" style={{ marginTop: 6 }}>No data yet</div>
          )}
        </div>
      </div>

      <div className="record-list" style={{ marginTop: '20px' }}>
        {records.map(rec => (
          <div key={rec.id} className="card" style={{ marginBottom: 12 }}>
            <div className="row">
              <strong>{rec.title}</strong>
              <span className="muted">{rec.service_date}</span>
            </div>
            <p style={{ margin: '8px 0 0', fontSize: '0.95em' }}>
              🚗 {rec.odometer_km} km | 🛠 Parts: {rec.parts_replaced} | 💰 {rec.cost} ILS
            </p>
            {rec.notes && <p style={{ fontStyle: 'italic', color: '#888' }}>{rec.notes}</p>}

            <div className="row" style={{ justifyContent: "flex-start", marginTop: 10 }}>
              <Link to={`/car/${id}/edit-record/${rec.id}`} state={{ rec }}>
                <span className="btn">Edit</span>
              </Link>
              <button className="btn btn--danger" onClick={() => onDeleteRecord(rec.id)}>
                Delete
              </button>
            </div>

            {rec.image_url && (
  <img 
    src={`http://127.0.0.1:8000/${rec.image_url}`} 
    alt="receipt" 
    className="receipt-preview" 
  />
)}
          </div>
        ))}
        {records.length === 0 && <p>No service records yet.</p>}
      </div>

      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
    </div>
  );
}
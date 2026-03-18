import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";

export default function Reminders() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    api
      .myReminders()
      .then(setItems)
      .catch((e) => setErr(String(e.message || e)));
  }, []);

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <button className="btn btn--ghost" onClick={() => navigate(-1)}>← Back</button>
      </div>
      <h2>Reminders</h2>
      {err && <p style={{ color: "crimson" }}>Error: {err}</p>}

      {items.length === 0 ? (
        <p className="muted">No reminders yet.</p>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 12 }}>
          {items.map((r) => (
            <div key={r.id} className="card">
              <div className="row">
                <b>{r.title}</b>
                {r.due_date && <span className="muted">Due: {r.due_date}</span>}
              </div>
              <p style={{ marginTop: 8 }}>{r.message}</p>
              {r.image_url && (
                <img
                  src={`http://127.0.0.1:8000/${r.image_url}`}
                  alt="reminder"
                  className="receipt-preview"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


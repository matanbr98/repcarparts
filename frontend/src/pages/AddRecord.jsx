import React, { useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "../services/api";

export default function AddRecord() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [file, setFile] = useState(null);
  const [err, setErr] = useState("");

  const TREATMENTS = useMemo(
    () => [
      { value: "oil_change", label: "Oil Change" },
      { value: "oil_filter", label: "Oil Filter" },
      { value: "air_filter", label: "Air Filter" },
      { value: "brake_pads", label: "Brake Pads", fields: ["position"] },
      { value: "battery", label: "Battery" },
      { value: "tires", label: "Tires", fields: ["tires_count", "tire_position"] },
      { value: "lights", label: "Lights" },
      { value: "wipers", label: "Wipers" },
      { value: "other", label: "Other", fields: ["custom_title"] },
    ],
    []
  );

  const [form, setForm] = useState({
    treatment_type: "oil_change",
    custom_title: "",
    service_date: new Date().toISOString().split("T")[0],
    odometer_km: "",
    cost: "",
    notes: "",
    // conditional
    position: "all",
    tires_count: "4",
    tire_position: "all",
  });

  const treatment = TREATMENTS.find((t) => t.value === form.treatment_type);
  const activeFields = new Set(treatment?.fields || []);
  const showPosition = activeFields.has("position");
  const showTires = activeFields.has("tires_count") || activeFields.has("tire_position");
  const showCustomTitle = activeFields.has("custom_title");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");

    const title = form.treatment_type === "other" ? (form.custom_title || "").trim() : treatment?.label;
    if (!title) {
      setErr("Please enter a title.");
      return;
    }
    
    // Create FormData to send file + text
    const data = new FormData();
    data.append("title", title);
    data.append("service_date", form.service_date);
    if (form.odometer_km !== "") data.append("odometer_km", String(Number(form.odometer_km)));
    if (form.cost !== "") data.append("cost", String(Number(form.cost)));
    if (form.notes) data.append("notes", form.notes);

    // Keep legacy field for analytics/reminders; store selected label (or custom)
    data.append("parts_replaced", title);

    // New structured fields (only when relevant)
    data.append("treatment_type", form.treatment_type);
    if (showPosition) data.append("position", form.position);
    if (showTires) {
      data.append("tire_position", form.tire_position);
      data.append("tires_count", String(Number(form.tires_count || 0)));
    }

    if (file) data.append("image", file);

    try {
      const res = await api.addRecord(id, data);
      if (res?.detail) throw new Error(res.detail);
      navigate(`/car/${id}`);
    } catch (e) {
      setErr(String(e.message || e));
    }
  };

  return (
    <div className="card col-6">
      <div className="row" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
        <Link to={`/car/${id}`} className="btn btn--ghost">← Back</Link>
      </div>

      <h2>Add Maintenance Record</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <div className="muted" style={{ marginBottom: 8 }}>Treatment / Part</div>
          <select
            value={form.treatment_type}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                treatment_type: e.target.value,
                // reset conditional fields when switching types
                custom_title: "",
                position: "all",
                tires_count: "4",
                tire_position: "all",
              }))
            }
          >
            {TREATMENTS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {showCustomTitle && (
          <input
            placeholder="Custom title (e.g. AC service)"
            value={form.custom_title}
            onChange={(e) => setForm((p) => ({ ...p, custom_title: e.target.value }))}
          />
        )}

        {showPosition && (
          <div>
            <div className="muted" style={{ marginBottom: 8 }}>Position</div>
            <select
              value={form.position}
              onChange={(e) => setForm((p) => ({ ...p, position: e.target.value }))}
            >
              <option value="front">Front</option>
              <option value="rear">Rear</option>
              <option value="all">All</option>
            </select>
          </div>
        )}

        {showTires && (
          <div className="grid" style={{ alignItems: "end" }}>
            <div className="col-6">
              <div className="muted" style={{ marginBottom: 8 }}>Number of tires replaced</div>
              <input
                type="number"
                min="1"
                max="4"
                value={form.tires_count}
                onChange={(e) => setForm((p) => ({ ...p, tires_count: e.target.value }))}
              />
            </div>
            <div className="col-6">
              <div className="muted" style={{ marginBottom: 8 }}>Tire position</div>
              <select
                value={form.tire_position}
                onChange={(e) => setForm((p) => ({ ...p, tire_position: e.target.value }))}
              >
                <option value="front">Front</option>
                <option value="rear">Rear</option>
                <option value="all">All</option>
                <option value="front_left">Front Left</option>
                <option value="front_right">Front Right</option>
                <option value="rear_left">Rear Left</option>
                <option value="rear_right">Rear Right</option>
              </select>
            </div>
          </div>
        )}

        <div className="grid">
          <div className="col-6">
            <div className="muted" style={{ marginBottom: 8 }}>Date</div>
            <input
              type="date"
              value={form.service_date}
              onChange={(e) => setForm((p) => ({ ...p, service_date: e.target.value }))}
            />
          </div>
          <div className="col-6">
            <div className="muted" style={{ marginBottom: 8 }}>Odometer (km)</div>
            <input
              type="number"
              placeholder="e.g. 187000"
              value={form.odometer_km}
              onChange={(e) => setForm((p) => ({ ...p, odometer_km: e.target.value }))}
            />
          </div>
        </div>

        <div className="grid">
          <div className="col-6">
            <div className="muted" style={{ marginBottom: 8 }}>Cost (ILS)</div>
            <input
              type="number"
              placeholder="e.g. 250"
              value={form.cost}
              onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
            />
          </div>
          <div className="col-6">
            <div className="muted" style={{ marginBottom: 8 }}>Receipt photo (optional)</div>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
          </div>
        </div>

        <textarea
          placeholder="Notes"
          value={form.notes}
          onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
        />

        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
        <button className="btn btn--primary" type="submit">Save</button>
      </form>
    </div>
  );
}
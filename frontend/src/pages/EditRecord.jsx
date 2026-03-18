import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, Link } from "react-router-dom";
import { api } from "../services/api";

export default function EditRecord() {
  const { id, recordId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const initial = useMemo(() => location.state?.rec || null, [location.state]);
  const [loading, setLoading] = useState(!initial);
  const [err, setErr] = useState("");
  const [formData, setFormData] = useState(
    initial || {
      title: "",
      service_date: new Date().toISOString().split("T")[0],
      odometer_km: "",
      parts_replaced: "",
      cost: 0,
      notes: "",
    }
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (initial) return;
      setErr("");
      setLoading(true);
      try {
        const records = await api.getRecords(id);
        const rec = records.find((r) => String(r.id) === String(recordId));
        if (!rec) throw new Error("Record not found");
        if (!cancelled) setFormData(rec);
      } catch (e) {
        if (!cancelled) setErr(String(e.message || e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id, recordId, initial]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr("");
    try {
      const patch = {
        title: formData.title,
        service_date: formData.service_date,
        odometer_km: formData.odometer_km === "" ? null : Number(formData.odometer_km),
        parts_replaced: formData.parts_replaced || null,
        cost: formData.cost === "" ? 0 : Number(formData.cost),
        notes: formData.notes || null,
      };
      await api.updateRecord(id, recordId, patch);
      navigate(`/car/${id}`);
    } catch (e) {
      setErr(String(e.message || e));
    }
  };

  if (loading) {
    return (
      <div className="card">
        <p>Loading…</p>
      </div>
    );
  }

  return (
    <div className="card">
      <Link to={`/car/${id}`} className="btn btn--ghost">← Back to Records</Link>
      <h2>Edit Service Record</h2>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 10 }}>
        <input
          placeholder="Service Title"
          required
          value={formData.title || ""}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        />
        <input
          type="date"
          value={formData.service_date || ""}
          onChange={(e) => setFormData({ ...formData, service_date: e.target.value })}
        />
        <input
          type="number"
          placeholder="KM Odometer"
          value={formData.odometer_km ?? ""}
          onChange={(e) => setFormData({ ...formData, odometer_km: e.target.value })}
        />
        <input
          placeholder="Parts Replaced"
          value={formData.parts_replaced || ""}
          onChange={(e) => setFormData({ ...formData, parts_replaced: e.target.value })}
        />
        <input
          type="number"
          placeholder="Cost (ILS)"
          value={formData.cost ?? 0}
          onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
        />
        <textarea
          placeholder="Notes"
          value={formData.notes || ""}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
        />
        {err && <p style={{ color: "crimson" }}>Error: {err}</p>}
        <button className="btn btn--primary" type="submit">Save Changes</button>
      </form>
    </div>
  );
}


import React, { useMemo, useState } from "react";
import { api } from "../services/api";
import { useNavigate, Link } from "react-router-dom";
import { CAR_CATALOG } from "../data/carCatalog";

export default function AddCar() {
  const makes = useMemo(() => CAR_CATALOG.map((x) => x.make).sort(), []);
  const [make, setMake] = useState(makes[0] || "");
  const [model, setModel] = useState("");
  const [customMake, setCustomMake] = useState("");
  const [customModel, setCustomModel] = useState("");

  const [formData, setFormData] = useState({
    nickname: "",
    year: "",
    license_plate: "",
  });
  const navigate = useNavigate();

  const modelsForMake = useMemo(() => {
    if (make === "Other") return [];
    const found = CAR_CATALOG.find((x) => x.make === make);
    return found ? found.models : [];
  }, [make]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalMake = make === "Other" ? customMake.trim() : make;
    const finalModel =
      make === "Other"
        ? customModel.trim()
        : model === "Other"
          ? customModel.trim()
          : model.trim();

    if (!formData.nickname.trim()) return;
    if (!finalMake) return;
    if (!finalModel) return;

    await api.createCar({
      ...formData,
      make: finalMake,
      model: finalModel,
      year: formData.year === "" ? null : Number(formData.year),
    });
    navigate('/'); // Go back to dashboard after adding
  };

  return (
    <div className="card col-6">
      <div className="row" style={{ justifyContent: "flex-start", marginBottom: 12 }}>
        <Link to="/" className="btn btn--ghost">← Back</Link>
      </div>

      <h2>Add a New Vehicle</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="Nickname (e.g. My Hyundai)"
          value={formData.nickname || ""}
          onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
          required
        />

        <div className="grid">
          <div className="col-6">
            <div className="muted" style={{ marginBottom: 8 }}>Company</div>
            <select
              value={make}
              onChange={(e) => {
                const nextMake = e.target.value;
                setMake(nextMake);
                setModel("");
                setCustomMake("");
                setCustomModel("");
              }}
            >
              {makes.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="col-6">
            <div className="muted" style={{ marginBottom: 8 }}>Model</div>
            {make === "Other" ? (
              <input
                placeholder="Model"
                value={customModel}
                onChange={(e) => setCustomModel(e.target.value)}
                required
              />
            ) : (
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                required
              >
                <option value="" disabled>Select model…</option>
                {modelsForMake.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="Other">Other</option>
              </select>
            )}
          </div>
        </div>

        {make === "Other" && (
          <input
            placeholder="Company"
            value={customMake}
            onChange={(e) => setCustomMake(e.target.value)}
            required
          />
        )}

        {make !== "Other" && model === "Other" && (
          <input
            placeholder="Custom model"
            value={customModel}
            onChange={(e) => setCustomModel(e.target.value)}
            required
          />
        )}

        <div className="grid">
          <div className="col-6">
            <input
              type="number"
              placeholder="Year"
              value={formData.year || ""}
              onChange={(e) => setFormData({ ...formData, year: e.target.value })}
            />
          </div>
          <div className="col-6">
            <input
              placeholder="License Plate"
              value={formData.license_plate || ""}
              onChange={(e) => setFormData({ ...formData, license_plate: e.target.value })}
            />
          </div>
        </div>
        <button className="btn btn--primary" type="submit">Save Car</button>
      </form>
    </div>
  );
}
import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { TREATMENTS, treatmentInfo } from "../lib/treatments";
import { todayISO } from "../lib/format";

const MAX_KM = 3000000;
const MAX_COST = 100000000;
const MAX_AHEAD_DAYS = 366;

function isoPlusDays(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}
import { validateImage } from "../lib/images";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Input, Select, Textarea } from "./ui/Field";
import { useToast } from "./ui/toastContext";
import ReceiptDropzone from "./ReceiptDropzone";

function initialState(rec) {
  if (!rec) {
    return {
      treatment_type: "oil_change",
      custom_title: "",
      service_date: todayISO(),
      odometer_km: "",
      cost: "",
      notes: "",
      position: "all",
      tires_count: "4",
      tire_position: "all",
    };
  }
  const known = TREATMENTS.some((t) => t.value === rec.treatment_type);
  const type = known ? rec.treatment_type : "other";
  return {
    treatment_type: type,
    custom_title: type === "other" ? rec.title || "" : "",
    service_date: rec.service_date || todayISO(),
    odometer_km: rec.odometer_km ?? "",
    cost: rec.cost ?? "",
    notes: rec.notes || "",
    position: rec.position || "all",
    tires_count: String(rec.tires_count ?? 4),
    tire_position: rec.tire_position || "all",
  };
}

/** Shared add + edit form for a service record. `record` present => edit mode. */
export default function ServiceForm({ carId, record = null }) {
  const isEdit = !!record;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(() => initialState(record));
  const original = useRef(initialState(record)).current; // baseline for "send only what changed"
  const [badInput, setBadInput] = useState({});
  const [file, setFile] = useState(null);
  const [removeExisting, setRemoveExisting] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const info = treatmentInfo(form.treatment_type);
  const fields = new Set(TREATMENTS.find((t) => t.value === form.treatment_type)?.fields || []);
  const showPosition = fields.has("position");
  const showTires = fields.has("tires");
  const showCustom = fields.has("custom_title");

  const set = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
    // a number input reports "" for malformed text such as "1e" or "12,5"; do not treat that as empty
    setBadInput((p) => ({ ...p, [key]: !!e.target.validity?.badInput }));
  };

  function chooseType(value) {
    setForm((p) => ({
      ...p,
      treatment_type: value,
      custom_title: value === "other" ? p.custom_title : "",
    }));
    setErrors((p) => ({ ...p, custom_title: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.service_date) e.service_date = "Choose the service date.";
    else if (form.service_date < "1900-01-01") e.service_date = "That date is too far in the past.";
    else if (form.service_date > isoPlusDays(MAX_AHEAD_DAYS)) e.service_date = "That date is more than a year ahead. Check the year.";
    if (badInput.odometer_km) e.odometer_km = "Enter digits only, for example 87500.";
    if (badInput.cost) e.cost = "Enter digits only, for example 250.";
    if (showCustom && !form.custom_title.trim()) e.custom_title = "Enter a title for this service.";
    if (!e.odometer_km && form.odometer_km !== "") {
      const n = Number(form.odometer_km);
      if (!Number.isInteger(n) || n < 0) e.odometer_km = "Enter a whole number of kilometres, 0 or more.";
      else if (n > MAX_KM) e.odometer_km = "That odometer reading is too high. Check for an extra digit.";
    }
    if (!e.cost && form.cost !== "") {
      const n = Number(form.cost);
      if (!Number.isInteger(n) || n < 0) e.cost = "Enter a whole amount, 0 or more.";
      else if (n > MAX_COST) e.cost = "That amount is too high. Check for an extra digit.";
    }
    if (showTires && (!isEdit || form.tires_count !== original.tires_count)) {
      const n = Number(form.tires_count);
      if (!Number.isInteger(n) || n < 1 || n > 4) e.tires_count = "Choose between 1 and 4 tires.";
    }
    if (file) {
      const msg = validateImage(file);
      if (msg) e.image = msg;
    }
    return e;
  }

  function resolveTitle() {
    if (showCustom) return form.custom_title.trim();
    if (isEdit && record.treatment_type === form.treatment_type && record.title) return record.title;
    return info.label;
  }

  function notifyWarnings(saved) {
    const w = saved?.warnings || [];
    if (w.length) toast.info(`Saved. Heads up: ${w[0].message}${w.length > 1 ? ` (+${w.length - 1} more on the vehicle page)` : ""}`);
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setFormError("");
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const title = resolveTitle();
    setSaving(true);
    try {
      if (isEdit) {
        // Only send fields the user actually changed, so untouched legacy values (free-text type,
        // parts, missing tire count...) are never rewritten by an unrelated edit.
        const patch = {};
        const typeChanged = form.treatment_type !== original.treatment_type;
        if (title !== record.title) patch.title = title;
        if (typeChanged) patch.treatment_type = form.treatment_type;
        if (typeChanged || patch.title) patch.parts_replaced = title;
        if (form.service_date !== original.service_date) patch.service_date = form.service_date;
        if (String(form.odometer_km) !== String(original.odometer_km))
          patch.odometer_km = form.odometer_km === "" ? null : Number(form.odometer_km);
        if (String(form.cost) !== String(original.cost)) patch.cost = form.cost === "" ? 0 : Number(form.cost);
        if (form.notes !== original.notes) patch.notes = form.notes.trim() || null;
        if (showPosition && form.position !== original.position) patch.position = form.position;
        if (showTires) {
          if (form.tire_position !== original.tire_position) patch.tire_position = form.tire_position;
          if (form.tires_count !== original.tires_count) patch.tires_count = Number(form.tires_count);
        } else if (typeChanged) {
          if (record.tire_position) patch.tire_position = null;
          if (record.tires_count != null) patch.tires_count = null;
        }
        if (typeChanged && !showPosition && record.position) patch.position = null;

        const imageChange = !!file || (removeExisting && !!record.image_url);
        if (Object.keys(patch).length === 0 && !imageChange) {
          toast.info("No changes to save");
          navigate(`/car/${carId}`);
          return;
        }
        let saved = null;
        if (Object.keys(patch).length) saved = await api.updateRecord(carId, record.id, patch);
        try {
          if (file) await api.replaceRecordImage(carId, record.id, file);
          else if (removeExisting && record.image_url) await api.removeRecordImage(carId, record.id);
        } catch (imgErr) {
          // the details are already saved: say so instead of reporting a failed save
          toast.error(`Details saved, but the receipt was not updated: ${imgErr.message || "upload failed"}`);
          navigate(`/car/${carId}`);
          return;
        }
        toast.success("Service updated");
        notifyWarnings(saved);
      } else {
        const data = new FormData();
        data.append("title", title);
        data.append("service_date", form.service_date);
        if (form.odometer_km !== "") data.append("odometer_km", String(Number(form.odometer_km)));
        if (form.cost !== "") data.append("cost", String(Number(form.cost)));
        if (form.notes.trim()) data.append("notes", form.notes.trim());
        data.append("parts_replaced", title);
        data.append("treatment_type", form.treatment_type);
        if (showPosition) data.append("position", form.position);
        if (showTires) {
          data.append("tire_position", form.tire_position);
          data.append("tires_count", String(Number(form.tires_count)));
        }
        if (file) data.append("image", file);
        const created = await api.addRecord(carId, data);
        toast.success("Service logged");
        notifyWarnings(created);
      }
      navigate(`/car/${carId}`);
    } catch (err) {
      const f = err.fields || {};
      const mapped = {};
      Object.entries(f).forEach(([k, v]) => {
        mapped[k === "title" ? "custom_title" : k === "image" ? "image" : k] = v;
      });
      if (Object.keys(mapped).length) setErrors((p) => ({ ...p, ...mapped }));
      setFormError(err.message || "Could not save the service. Please try again.");
      setSaving(false);
    }
  }

  return (
    <form className="stack-lg" onSubmit={onSubmit} noValidate>
      <fieldset className="service-form__types">
        <legend className="field__label">What was done?</legend>
        <div className="treatment-grid" role="radiogroup" aria-label="Treatment type">
          {TREATMENTS.map((t) => (
            <label
              key={t.value}
              className={`treatment-tile${form.treatment_type === t.value ? " treatment-tile--active" : ""}`}
            >
              <input
                type="radio"
                name="treatment_type"
                value={t.value}
                checked={form.treatment_type === t.value}
                onChange={() => chooseType(t.value)}
                className="sr-only"
              />
              <Icon name={t.icon} size={24} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {showCustom && (
        <Input
          label="Service title"
          placeholder="e.g. AC service"
          value={form.custom_title}
          onChange={set("custom_title")}
          error={errors.custom_title}
          maxLength={120}
        />
      )}

      {showPosition && (
        <Select label="Position" value={form.position} onChange={set("position")}>
          <option value="front">Front</option>
          <option value="rear">Rear</option>
          <option value="all">All</option>
        </Select>
      )}

      {showTires && (
        <div className="grid-2">
          <Input
            label="Tires replaced"
            type="number"
            inputMode="numeric"
            min="1"
            max="4"
            value={form.tires_count}
            onChange={set("tires_count")}
            error={errors.tires_count}
          />
          <Select label="Tire position" value={form.tire_position} onChange={set("tire_position")}>
            <option value="all">All</option>
            <option value="front">Front</option>
            <option value="rear">Rear</option>
            <option value="front_left">Front left</option>
            <option value="front_right">Front right</option>
            <option value="rear_left">Rear left</option>
            <option value="rear_right">Rear right</option>
          </Select>
        </div>
      )}

      <div className="grid-2">
        <Input
          label="Date"
          type="date"
          min="1900-01-01"
          max={isoPlusDays(MAX_AHEAD_DAYS)}
          value={form.service_date}
          onChange={set("service_date")}
          error={errors.service_date}
          hint={form.service_date > todayISO() && !errors.service_date ? "This date is in the future." : undefined}
        />
        <Input
          label="Odometer (km)"
          type="number"
          inputMode="numeric"
          min="0"
          max={MAX_KM}
          placeholder="e.g. 87500"
          optional
          value={form.odometer_km}
          onChange={set("odometer_km")}
          error={errors.odometer_km}
        />
      </div>

      <Input
        label="Cost (ILS)"
        type="number"
        inputMode="numeric"
        min="0"
        max={MAX_COST}
        placeholder="e.g. 250"
        optional
        value={form.cost}
        onChange={set("cost")}
        error={errors.cost}
      />

      <Textarea label="Notes" optional value={form.notes} onChange={set("notes")} maxLength={1000} />

      <ReceiptDropzone
        file={file}
        existingUrl={isEdit && !removeExisting ? record.image_url : null}
        onChange={(f) => {
          setFile(f);
          if (f) {
            setRemoveExisting(false);
            setErrors((p) => ({ ...p, image: validateImage(f) || undefined }));
          } else {
            setErrors((p) => ({ ...p, image: undefined }));
          }
        }}
        onRemoveExisting={() => {
          setFile(null);
          setRemoveExisting(true);
        }}
        error={errors.image}
      />

      {formError && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {formError}
        </p>
      )}

      <div className="cluster">
        <Button type="submit" variant="primary" size="lg" loading={saving}>
          {isEdit ? "Save changes" : "Save service"}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate(`/car/${carId}`)} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

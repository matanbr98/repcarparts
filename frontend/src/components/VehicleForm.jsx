import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../services/api";
import { CAR_CATALOG } from "../data/carCatalog";
import Button from "./ui/Button";
import Icon from "./ui/Icon";
import { Input, Select } from "./ui/Field";
import { useToast } from "./ui/toastContext";
import { t } from "../i18n";

const MAKES = CAR_CATALOG.map((x) => x.make).sort();

function initial(car) {
  if (!car) return { make: MAKES[0] || "", model: "", customMake: "", customModel: "", nickname: "", year: "", license_plate: "" };
  const catalogEntry = CAR_CATALOG.find((x) => x.make.toLowerCase() === String(car.make || "").toLowerCase());
  const makeKnown = !!catalogEntry;
  const modelEntry = catalogEntry?.models.find((m) => m.toLowerCase() === String(car.model || "").toLowerCase());
  return {
    make: makeKnown ? catalogEntry.make : "Other",
    model: makeKnown ? modelEntry || "Other" : "",
    customMake: makeKnown ? "" : car.make || "",
    customModel: makeKnown && modelEntry ? "" : car.model || "",
    nickname: car.nickname || "",
    year: car.year ?? "",
    license_plate: car.license_plate || "",
  };
}

/** Add/edit a vehicle. `car` present => edit mode (PUT /cars/{id}). Keeps the carCatalog behaviour. */
export default function VehicleForm({ car = null }) {
  const isEdit = !!car;
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState(() => initial(car));
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const modelsForMake = useMemo(() => CAR_CATALOG.find((x) => x.make === form.make)?.models || [], [form.make]);
  const set = (key) => (e) => {
    setForm((p) => ({ ...p, [key]: e.target.value }));
    setErrors((p) => ({ ...p, [key]: undefined }));
  };

  const otherMake = form.make === "Other";
  const customModelVisible = otherMake || form.model === "Other";
  const back = isEdit ? `/car/${car.id}` : "/";

  async function onSubmit(ev) {
    ev.preventDefault();
    setFormError("");
    const finalMake = otherMake ? form.customMake.trim() : form.make;
    const finalModel = customModelVisible ? form.customModel.trim() : form.model.trim();
    const e = {};
    if (!form.nickname.trim()) e.nickname = t("Give the vehicle a nickname.");
    if (!finalMake) e.customMake = t("Enter the manufacturer.");
    if (!finalModel) e[otherMake || form.model === "Other" ? "customModel" : "model"] = t("Choose or enter the model.");
    if (form.year !== "") {
      const y = Number(form.year);
      if (!Number.isInteger(y) || y < 1950 || y > new Date().getFullYear() + 1) e.year = t("Enter a valid year.");
    }
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      nickname: form.nickname.trim(),
      make: finalMake,
      model: finalModel,
      year: form.year === "" ? null : Number(form.year),
      license_plate: form.license_plate.trim() || null,
    };
    setSaving(true);
    try {
      if (isEdit) {
        await api.updateCar(car.id, payload);
        toast.success(t("Vehicle updated"));
        navigate(`/car/${car.id}`);
      } else {
        await api.createCar(payload);
        toast.success(t("Vehicle added"));
        navigate("/");
      }
    } catch (err) {
      if (err.fields && Object.keys(err.fields).length) setErrors((p) => ({ ...p, ...err.fields }));
      setFormError(err.message || t("Could not save the vehicle."));
      setSaving(false);
    }
  }

  return (
    <form className="stack-lg" onSubmit={onSubmit} noValidate>
      <Input
        label={t("Nickname")}
        placeholder={t("e.g. Family Hyundai")}
        value={form.nickname}
        onChange={set("nickname")}
        error={errors.nickname}
        maxLength={60}
      />

      <div className="grid-2">
        <Select
          label={t("Make")}
          value={form.make}
          onChange={(e) => {
            setForm((p) => ({ ...p, make: e.target.value, model: "", customMake: "", customModel: "" }));
            setErrors({});
          }}
        >
          {MAKES.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
          <option value="Other">{t("Other")}</option>
        </Select>

        {otherMake ? (
          <Input label={t("Make name")} value={form.customMake} onChange={set("customMake")} error={errors.customMake} />
        ) : (
          <Select label={t("Model")} value={form.model} onChange={set("model")} error={errors.model}>
            <option value="" disabled>
              {t("Select model...")}
            </option>
            {modelsForMake.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
            <option value="Other">{t("Other")}</option>
          </Select>
        )}
      </div>

      {customModelVisible && (
        <Input
          label={otherMake ? t("Model") : t("Custom model")}
          value={form.customModel}
          onChange={set("customModel")}
          error={errors.customModel}
        />
      )}

      <div className="grid-2">
        <Input
          label={t("Year")}
          type="number"
          inputMode="numeric"
          optional
          value={form.year}
          onChange={set("year")}
          error={errors.year}
        />
        <Input
          label={t("License plate")}
          optional
          value={form.license_plate}
          onChange={set("license_plate")}
          error={errors.license_plate}
        />
      </div>

      {formError && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {formError}
        </p>
      )}

      <div className="form-actions form-actions--bar">
        <Button type="submit" variant="primary" size="lg" loading={saving}>
          {isEdit ? t("Save changes") : t("Save vehicle")}
        </Button>
        <Button variant="ghost" size="lg" onClick={() => navigate(back)} disabled={saving}>
          {t("Cancel")}
        </Button>
      </div>
    </form>
  );
}

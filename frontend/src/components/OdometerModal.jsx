import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Input } from "./ui/Field";
import { useToast } from "./ui/toastContext";
import { api } from "../services/api";
import { formatDate, formatKm } from "../lib/format";
import { t } from "../i18n";

/** Update the current odometer without logging a service. */
export default function OdometerModal({ open, carId, odometer, onClose, onSaved }) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setValue(odometer?.odometer_km != null ? String(odometer.odometer_km) : "");
      setError("");
    }
  }, [open, odometer?.odometer_km]);

  const floor = odometer?.last_record_km ?? null;

  async function submit(e) {
    e.preventDefault();
    const n = Number(value);
    if (value === "" || !Number.isInteger(n) || n < 0) {
      setError(t("Enter the current odometer reading in whole kilometres."));
      return;
    }
    if (floor != null && n < floor) {
      setError(t("Must be at least {km}, the highest reading in the service history.", { km: formatKm(floor) }));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.setOdometer(carId, n);
      toast.success(t("Odometer updated"));
      onSaved?.(res);
    } catch (err) {
      setError(err.fields?.odometer_km || err.message || t("Could not update the odometer."));
    } finally {
      setBusy(false);
    }
  }

  let hint = t("Used to work out when mileage-based maintenance is due.");
  if (odometer?.odometer_km != null) {
    const km = formatKm(odometer.odometer_km);
    hint =
      odometer.source === "manual" && odometer.manual_updated_at
        ? t("Currently {km}, updated {date}.", { km, date: formatDate(odometer.manual_updated_at) })
        : odometer.source === "service"
          ? t("Currently {km}, taken from the latest service.", { km })
          : t("Currently {km}.", { km });
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title={t("Update odometer")}
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("Cancel")}
          </Button>
          <Button variant="primary" type="submit" form="odometer-form" loading={busy}>
            {t("Save")}
          </Button>
        </>
      }
    >
      <form id="odometer-form" onSubmit={submit} className="stack">
        <Input
          label={t("Current odometer (km)")}
          type="number"
          inputMode="numeric"
          min={floor ?? 0}
          step="1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          error={error}
          hint={hint}
          data-autofocus
        />
      </form>
    </Modal>
  );
}

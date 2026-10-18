import { useEffect, useState } from "react";
import Modal from "./ui/Modal";
import Button from "./ui/Button";
import { Input } from "./ui/Field";
import { useToast } from "./ui/toastContext";
import { api } from "../services/api";
import { formatDate, formatKm } from "../lib/format";

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
      setError("Enter the current odometer reading in whole kilometres.");
      return;
    }
    if (floor != null && n < floor) {
      setError(`Must be at least ${formatKm(floor)}, the highest reading in the service history.`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await api.setOdometer(carId, n);
      toast.success("Odometer updated");
      onSaved?.(res);
    } catch (err) {
      setError(err.fields?.odometer_km || err.message || "Could not update the odometer.");
    } finally {
      setBusy(false);
    }
  }

  let hint = "Used to work out when mileage-based maintenance is due.";
  if (odometer?.odometer_km != null) {
    const suffix =
      odometer.source === "manual" && odometer.manual_updated_at
        ? `, updated ${formatDate(odometer.manual_updated_at)}`
        : odometer.source === "service"
          ? ", taken from the latest service"
          : "";
    hint = `Currently ${formatKm(odometer.odometer_km)}${suffix}.`;
  }

  return (
    <Modal
      open={open}
      onClose={busy ? undefined : onClose}
      title="Update odometer"
      actions={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="odometer-form" loading={busy}>
            Save
          </Button>
        </>
      }
    >
      <form id="odometer-form" onSubmit={submit} className="stack">
        <Input
          label="Current odometer (km)"
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

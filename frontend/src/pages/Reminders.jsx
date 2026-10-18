import { useMemo, useState } from "react";
import { api, assetUrl } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/ui/toastContext";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import Badge from "../components/ui/Badge";
import Modal, { ConfirmDialog } from "../components/ui/Modal";
import { Input, Select, Textarea } from "../components/ui/Field";
import EmptyState from "../components/ui/EmptyState";
import ErrorState from "../components/ui/ErrorState";
import { SkeletonCard } from "../components/ui/Skeleton";
import ReceiptLightbox from "../components/ReceiptLightbox";
import { formatDate, todayISO, vehicleTitle } from "../lib/format";

function ReminderItem({ r, overdue, onToggle, onDelete, onImage, busy }) {
  const isSelf = r.source === "self";
  return (
    <li className={`reminder${r.done ? " reminder--done" : ""}`}>
      <button
        type="button"
        className="reminder__check"
        role="checkbox"
        aria-checked={!!r.done}
        aria-label={r.done ? `Mark "${r.title}" as not done` : `Mark "${r.title}" as done`}
        onClick={() => onToggle(r)}
        disabled={busy}
      >
        {r.done && <Icon name="check" size={16} strokeWidth={3} />}
      </button>
      <div className="reminder__body">
        <div className="cluster">
          <strong className="reminder__title">{r.title}</strong>
          {overdue && (
            <span className="badge badge--overdue">
              <Icon name="alert" size={14} /> Overdue
            </span>
          )}
          <Badge tone={isSelf ? undefined : "teal"}>{isSelf ? "My reminder" : "From manager"}</Badge>
        </div>
        {r.message && <p className="reminder__msg">{r.message}</p>}
        <p className="muted small">
          {r.due_date && (
            <>
              <Icon name="calendar" size={14} className="inline-icon" /> Due {formatDate(r.due_date)}
            </>
          )}
          {r.car_label && (
            <>
              {r.due_date ? "  -  " : ""}
              <Icon name="car" size={14} className="inline-icon" /> {r.car_label}
            </>
          )}
          {r.done && r.done_at && <>{"  -  "}Done {formatDate(r.done_at)}</>}
        </p>
        {r.image_url && (
          <button type="button" className="receipt-thumb" onClick={() => onImage(r)} aria-label={`View image for ${r.title}`}>
            <img src={assetUrl(r.image_url)} alt="" loading="lazy" />
          </button>
        )}
      </div>
      {isSelf && (
        <Button size="sm" variant="danger-ghost" onClick={() => onDelete(r)} aria-label={`Delete ${r.title}`}>
          <Icon name="trash" size={14} />
        </Button>
      )}
    </li>
  );
}

function Group({ title, items, overdue, ...handlers }) {
  if (items.length === 0) return null;
  return (
    <section className="stack" aria-label={title}>
      <h2>
        {title} <span className="muted small">({items.length})</span>
      </h2>
      <ul className="reminder-list card card--flush">
        {items.map((r) => (
          <ReminderItem key={r.id} r={r} overdue={overdue} {...handlers} />
        ))}
      </ul>
    </section>
  );
}

function NewReminderModal({ open, onClose, onCreated }) {
  const toast = useToast();
  const cars = useAsync(
    async () => {
      if (!open) return [];
      // a manager's /cars lists everyone's vehicles, but a reminder can only point at your own
      const [list, me] = await Promise.all([api.getCars(), api.me()]);
      return list.filter((c) => c.user_id === me.id);
    },
    [open]
  );
  const [form, setForm] = useState({ title: "", message: "", due_date: "", car_id: "" });
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };

  async function submit(e) {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrors({ title: "Enter a title." });
      return;
    }
    setSaving(true);
    try {
      const payload = { title: form.title.trim() };
      if (form.message.trim()) payload.message = form.message.trim();
      if (form.due_date) payload.due_date = form.due_date;
      if (form.car_id) payload.car_id = Number(form.car_id);
      const created = await api.createReminder(payload);
      toast.success("Reminder added");
      setForm({ title: "", message: "", due_date: "", car_id: "" });
      onCreated(created);
    } catch (err) {
      setErrors({ ...(err.fields || {}), form: err.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="New reminder">
      <form className="stack" onSubmit={submit} noValidate>
        <Input label="Title" value={form.title} onChange={set("title")} error={errors.title} data-autofocus maxLength={120} />
        <Textarea label="Details" optional value={form.message} onChange={set("message")} error={errors.message} />
        <div className="grid-2">
          <Input label="Due date" type="date" optional min={todayISO()} value={form.due_date} onChange={set("due_date")} error={errors.due_date} />
          <Select label="Vehicle" optional value={form.car_id} onChange={set("car_id")} error={errors.car_id}>
            <option value="">No vehicle</option>
            {(cars.data || []).map((c) => (
              <option key={c.id} value={c.id}>
                {vehicleTitle(c)}
              </option>
            ))}
          </Select>
        </div>
        {errors.form && (
          <p className="form-error" role="alert">
            <Icon name="alert" size={16} /> {errors.form}
          </p>
        )}
        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={saving}>
            Add reminder
          </Button>
        </div>
      </form>
    </Modal>
  );
}

export default function Reminders() {
  const toast = useToast();
  const { data, error, loading, reload, setData } = useAsync(() => api.myReminders(), []);
  const [creating, setCreating] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [image, setImage] = useState(null);

  const groups = useMemo(() => {
    const today = todayISO();
    const items = data || [];
    const open = items.filter((r) => !r.done);
    const byDue = (a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999"));
    return {
      overdue: open.filter((r) => r.due_date && r.due_date < today).sort(byDue),
      upcoming: open.filter((r) => !r.due_date || r.due_date >= today).sort(byDue),
      done: items.filter((r) => r.done),
    };
  }, [data]);

  async function toggle(r) {
    setBusyId(r.id);
    try {
      const updated = await api.setReminderDone(r.id, !r.done);
      setData((prev) => (prev || []).map((x) => (x.id === r.id ? { ...x, ...(updated || {}), done: !r.done } : x)));
    } catch (e) {
      toast.error(e.message || "Could not update the reminder.");
    } finally {
      setBusyId(null);
    }
  }

  async function confirmDelete() {
    setDeleting(true);
    try {
      await api.deleteReminder(toDelete.id);
      setData((prev) => (prev || []).filter((x) => x.id !== toDelete.id));
      toast.success("Reminder deleted");
      setToDelete(null);
    } catch (e) {
      toast.error(e.message || "Could not delete the reminder.");
    } finally {
      setDeleting(false);
    }
  }

  const total = (data || []).length;
  const handlers = { onToggle: toggle, onDelete: setToDelete, onImage: setImage, busy: false };

  return (
    <div className="stack-lg">
      <PageHeader
        title="Reminders"
        subtitle="Service nudges from your manager and notes to yourself."
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New reminder
          </Button>
        }
      />

      {error && !data ? (
        <ErrorState error={error} title="Could not load reminders" onRetry={reload} />
      ) : loading && !data ? (
        <div className="stack" role="status" aria-label="Loading reminders">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : total === 0 ? (
        <EmptyState icon="bell" title="Nothing to remember" text="Add a reminder for an upcoming service, an inspection or anything car related.">
          <Button variant="primary" onClick={() => setCreating(true)}>
            <Icon name="plus" size={16} /> New reminder
          </Button>
        </EmptyState>
      ) : (
        <>
          <Group title="Overdue" items={groups.overdue} overdue {...handlers} busy={busyId !== null} />
          <Group title="Upcoming" items={groups.upcoming} {...handlers} busy={busyId !== null} />
          <Group title="Done" items={groups.done} {...handlers} busy={busyId !== null} />
        </>
      )}

      <NewReminderModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          reload();
        }}
      />
      <ConfirmDialog
        open={!!toDelete}
        title="Delete this reminder?"
        message={toDelete ? `"${toDelete.title}" will be removed.` : ""}
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={confirmDelete}
      />
      <ReceiptLightbox imageUrl={image?.image_url} title={image?.title} onClose={() => setImage(null)} />
    </div>
  );
}

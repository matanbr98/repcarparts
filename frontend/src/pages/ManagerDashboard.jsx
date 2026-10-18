import { useState } from "react";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/ui/toastContext";
import PageHeader from "../components/ui/PageHeader";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Input, Select, Textarea } from "../components/ui/Field";
import ErrorState from "../components/ui/ErrorState";
import EmptyState from "../components/ui/EmptyState";
import Skeleton, { SkeletonCard } from "../components/ui/Skeleton";
import Avatar from "../components/Avatar";
import ReceiptDropzone from "../components/ReceiptDropzone";
import { validateImage } from "../lib/images";
import { formatMoney, formatNumber, vehicleTitle } from "../lib/format";
import { treatmentLabel } from "../lib/treatments";

function SendReminderForm({ users, cars }) {
  const toast = useToast();
  const [form, setForm] = useState({
    title: "",
    message: "",
    broadcast_all_users: true,
    target_user_id: "",
    target_car_id: "",
    due_date: "",
  });
  const [file, setFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);

  const set = (k) => (e) => {
    setForm((p) => ({ ...p, [k]: e.target.value }));
    setErrors((p) => ({ ...p, [k]: undefined }));
  };
  const customers = users.filter((u) => u.role !== "manager");
  const userCars = cars.filter((c) => String(c.user_id) === String(form.target_user_id));

  async function onSubmit(e) {
    e.preventDefault();
    const v = {};
    if (!form.title.trim()) v.title = "Enter a title.";
    if (!form.message.trim()) v.message = "Enter a message.";
    if (!form.broadcast_all_users && !form.target_user_id) v.target_user_id = "Choose a user.";
    if (file) {
      const m = validateImage(file);
      if (m) v.image = m;
    }
    setErrors(v);
    if (Object.keys(v).length) return;

    setSending(true);
    try {
      const fd = new FormData();
      fd.append("title", form.title.trim());
      fd.append("message", form.message.trim());
      fd.append("broadcast_all_users", String(!!form.broadcast_all_users));
      if (!form.broadcast_all_users) {
        fd.append("target_user_id", String(Number(form.target_user_id)));
        if (form.target_car_id) fd.append("target_car_id", String(Number(form.target_car_id)));
      }
      if (form.due_date) fd.append("due_date", form.due_date);
      if (file) fd.append("image", file);
      const res = await api.managerSendReminder(fd);
      const n = Array.isArray(res) ? res.length : 1;
      toast.success(`Sent ${n} reminder${n === 1 ? "" : "s"}`);
      setForm((p) => ({ ...p, title: "", message: "", due_date: "" }));
      setFile(null);
    } catch (err) {
      setErrors({ ...(err.fields || {}), form: err.message });
    } finally {
      setSending(false);
    }
  }

  return (
    <form className="stack" onSubmit={onSubmit} noValidate>
      <Input label="Title" value={form.title} onChange={set("title")} error={errors.title} />
      <Textarea label="Message" value={form.message} onChange={set("message")} error={errors.message} />

      <label className="check">
        <input
          type="checkbox"
          checked={form.broadcast_all_users}
          onChange={(e) => setForm((p) => ({ ...p, broadcast_all_users: e.target.checked, target_car_id: "" }))}
        />
        <span>Send to all users</span>
      </label>

      {!form.broadcast_all_users && (
        <div className="grid-2">
          <Select
            label="User"
            value={form.target_user_id}
            onChange={(e) => {
              setForm((p) => ({ ...p, target_user_id: e.target.value, target_car_id: "" }));
              setErrors((p) => ({ ...p, target_user_id: undefined }));
            }}
            error={errors.target_user_id}
          >
            <option value="">Select user...</option>
            {customers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username} (#{u.id})
              </option>
            ))}
          </Select>
          <Select
            label="Vehicle"
            optional
            value={form.target_car_id}
            onChange={set("target_car_id")}
            disabled={!form.target_user_id}
            error={errors.target_car_id}
          >
            <option value="">No specific vehicle</option>
            {userCars.map((c) => (
              <option key={c.id} value={c.id}>
                {vehicleTitle(c)} (#{c.id})
              </option>
            ))}
          </Select>
        </div>
      )}

      <Input label="Due date" type="date" optional value={form.due_date} onChange={set("due_date")} error={errors.due_date} />

      <ReceiptDropzone label="Attach image" file={file} onChange={setFile} error={errors.image} />

      {errors.form && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {errors.form}
        </p>
      )}
      <div>
        <Button type="submit" variant="primary" loading={sending}>
          <Icon name="bell" size={16} /> Send reminder
        </Button>
      </div>
    </form>
  );
}

export default function ManagerDashboard() {
  const { data, error, loading, reload } = useAsync(async () => {
    const [users, stats, parts, cars] = await Promise.all([
      api.managerUsers(),
      api.managerStats(),
      api.managerPartAverages(),
      api.getCars().catch(() => []),
    ]);
    return { users, stats, parts, cars };
  }, []);

  return (
    <div className="stack-lg">
      <PageHeader title="Manager dashboard" subtitle="Users, spend across the fleet and reminders." />

      {error && !data ? (
        <ErrorState error={error} title="Could not load the dashboard" onRetry={reload} />
      ) : loading && !data ? (
        <div className="stack-lg" role="status" aria-label="Loading dashboard">
          <Skeleton height={88} radius={12} />
          <SkeletonCard lines={5} />
        </div>
      ) : (
        <>
          <dl className="summary-strip">
            {[
              ["Users", formatNumber(data.stats.users)],
              ["Cars", formatNumber(data.stats.cars)],
              ["Records", formatNumber(data.stats.records)],
              ["Total cost", formatMoney(data.stats.total_cost)],
            ].map(([label, value]) => (
              <div key={label} className="summary-strip__item">
                <dt className="muted small">{label}</dt>
                <dd className="num">{value}</dd>
              </div>
            ))}
          </dl>

          <Card>
            <h2 className="card__title">Users</h2>
            {data.users.length === 0 ? (
              <EmptyState icon="user" title="No users yet" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">ID</th>
                      <th scope="col">User</th>
                      <th scope="col">Role</th>
                      <th scope="col">Contact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.users.map((u) => (
                      <tr key={u.id}>
                        <td className="num">#{u.id}</td>
                        <td>
                          <span className="cluster">
                            <Avatar url={u.profile_image_url} name={u.username} size={28} />
                            <strong>{u.username}</strong>
                            {u.name && <span className="muted">{u.name}</span>}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${u.role === "manager" ? "badge--teal" : ""}`}>{u.role}</span>
                        </td>
                        <td className="muted">{[u.email, u.phone].filter(Boolean).join(" / ") || "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="card__title">Send reminder</h2>
            <SendReminderForm users={data.users} cars={data.cars} />
          </Card>

          <Card>
            <h2 className="card__title">Average cost per part</h2>
            {data.parts.length === 0 ? (
              <p className="muted">No parts data yet.</p>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th scope="col">Part</th>
                      <th scope="col" className="table__num">Records</th>
                      <th scope="col" className="table__num">Average (ILS)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.parts.slice(0, 30).map((p) => (
                      <tr key={p.part}>
                        <td>{treatmentLabel(p.part)}</td>
                        <td className="num table__num">{p.count}</td>
                        <td className="num table__num">{Number(p.avg_cost).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

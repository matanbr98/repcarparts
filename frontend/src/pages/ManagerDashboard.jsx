import { useMemo, useState } from "react";
import { api } from "../services/api";
import { useAsync } from "../hooks/useAsync";
import { useToast } from "../components/ui/toastContext";
import PageHeader from "../components/ui/PageHeader";
import Button from "../components/ui/Button";
import Icon from "../components/ui/Icon";
import { Input, Select, Switch, Textarea } from "../components/ui/Field";
import StatCard from "../components/ui/StatCard";
import Tabs from "../components/ui/Tabs";
import Segmented from "../components/ui/Segmented";
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

      <div className="form-section">
        <Switch
          label="Send to all users"
          description={
            form.broadcast_all_users
              ? `Every customer account (${customers.length}) receives this reminder.`
              : "Choose one customer and, optionally, one of their vehicles."
          }
          checked={form.broadcast_all_users}
          onChange={(e) => setForm((p) => ({ ...p, broadcast_all_users: e.target.checked, target_car_id: "" }))}
        />

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
      </div>

      <Input label="Due date" type="date" optional value={form.due_date} onChange={set("due_date")} error={errors.due_date} />

      <ReceiptDropzone label="Attach image" file={file} onChange={setFile} error={errors.image} />

      {errors.form && (
        <p className="form-error" role="alert">
          <Icon name="alert" size={16} /> {errors.form}
        </p>
      )}
      <div className="form-actions">
        <Button type="submit" variant="accent" loading={sending}>
          <Icon name="send" size={16} /> Send reminder
        </Button>
      </div>
    </form>
  );
}

function UsersPanel({ users }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const managers = users.filter((u) => u.role === "manager").length;
  const query = q.trim().toLowerCase();
  const visible = users.filter((u) => {
    if (role === "manager" && u.role !== "manager") return false;
    if (role === "customer" && u.role === "manager") return false;
    if (!query) return true;
    return [u.username, u.name, u.email, u.phone, `#${u.id}`].filter(Boolean).join(" ").toLowerCase().includes(query);
  });

  return (
    <section className="card card--flush" role="tabpanel" id="panel-users" aria-labelledby="tab-users">
      <div className="card__header">
        <Input
          label="Search users"
          hideLabel
          icon="search"
          type="search"
          placeholder="Search name, username, email or phone"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fieldClassName="toolbar__search"
        />
        <Segmented
          label="Filter by role"
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: "All", count: users.length },
            { value: "customer", label: "Customers", count: users.length - managers },
            { value: "manager", label: "Managers", count: managers },
          ]}
        />
      </div>
      {users.length === 0 ? (
        <EmptyState compact icon="users" title="No users yet" />
      ) : visible.length === 0 ? (
        <EmptyState compact icon="search" title="No users match" text="Try a different search or role filter." />
      ) : (
        <div className="table-wrap">
          <table className="table table--stack">
            <thead>
              <tr>
                <th scope="col">User</th>
                <th scope="col">Role</th>
                <th scope="col">Email</th>
                <th scope="col">Phone</th>
                <th scope="col" className="table__num">ID</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((u) => (
                <tr key={u.id}>
                  <td className="table__primary">
                    <span className="user-cell">
                      <Avatar url={u.profile_image_url} name={u.username} size={32} />
                      <span className="user-cell__text">
                        <strong className="truncate">{u.username}</strong>
                        {u.name && <span className="muted small truncate">{u.name}</span>}
                      </span>
                    </span>
                  </td>
                  <td data-label="Role">
                    <span className={`badge ${u.role === "manager" ? "badge--accent" : ""}`}>
                      {u.role === "manager" && <Icon name="shield" size={12} />}
                      {u.role}
                    </span>
                  </td>
                  <td data-label="Email" className="table__muted">
                    {u.email ? <a href={`mailto:${u.email}`}>{u.email}</a> : "-"}
                  </td>
                  <td data-label="Phone" className="table__muted num">
                    {u.phone || "-"}
                  </td>
                  <td data-label="ID" className="num table__num table__muted">
                    #{u.id}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function PartsPanel({ parts }) {
  const [showAll, setShowAll] = useState(false);
  const max = useMemo(() => Math.max(1, ...parts.map((p) => Number(p.avg_cost) || 0)), [parts]);
  const rows = showAll ? parts : parts.slice(0, 30);

  return (
    <section className="card card--flush" role="tabpanel" id="panel-parts" aria-labelledby="tab-parts">
      <div className="card__header">
        <div>
          <h2 className="card__title">Average cost per part</h2>
          <p className="card__subtitle">Across all service records in the fleet</p>
        </div>
      </div>
      {parts.length === 0 ? (
        <EmptyState compact icon="chart" title="No parts data yet" text="Averages appear once services with a cost are logged." />
      ) : (
        <>
          <div className="table-wrap">
            <table className="table table--stack">
              <thead>
                <tr>
                  <th scope="col">Part</th>
                  <th scope="col" className="table__num">Records</th>
                  <th scope="col" className="table__num">Average (ILS)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.part}>
                    <td className="table__primary">
                      <strong>{treatmentLabel(p.part)}</strong>
                    </td>
                    <td data-label="Records" className="num table__num">
                      {p.count}
                    </td>
                    <td data-label="Average (ILS)" className="num table__num">
                      <span className="table-bar">
                        <span className="table-bar__track" aria-hidden="true">
                          <span
                            className="table-bar__fill"
                            style={{ width: `${Math.round(((Number(p.avg_cost) || 0) / max) * 100)}%` }}
                          />
                        </span>
                        {Number(p.avg_cost).toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {parts.length > 30 && (
            <div className="table-foot">
              <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
                {showAll ? "Show top 30" : `Show all ${parts.length} parts`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}

export default function ManagerDashboard() {
  const [tab, setTab] = useState("users");
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
      <PageHeader
        title="Manager dashboard"
        subtitle="Users, spend across the fleet and reminders."
        actions={
          data && (
            <Button variant="accent" onClick={() => setTab("send")}>
              <Icon name="send" size={16} /> Send reminder
            </Button>
          )
        }
      />

      {error && !data ? (
        <ErrorState error={error} title="Could not load the dashboard" onRetry={reload} />
      ) : loading && !data ? (
        <div className="stack-lg" role="status" aria-label="Loading dashboard">
          <div className="grid-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} height={104} radius={14} />
            ))}
          </div>
          <SkeletonCard lines={5} />
        </div>
      ) : (
        <>
          <div className="grid-4">
            <StatCard label="Users" value={formatNumber(data.stats.users)} icon="users" tone="info" hint="Registered accounts" />
            <StatCard label="Vehicles" value={formatNumber(data.stats.cars)} icon="car" hint="Across all users" />
            <StatCard label="Service records" value={formatNumber(data.stats.records)} icon="wrench" hint="Logged in total" />
            <StatCard label="Total cost" value={formatMoney(data.stats.total_cost)} icon="coins" tone="accent" hint="All records, all time" />
          </div>

          <div className="stack">
            <Tabs
              label="Manager sections"
              value={tab}
              onChange={setTab}
              tabs={[
                { id: "users", label: "Users", count: data.users.length },
                { id: "parts", label: "Cost per part", count: data.parts.length },
                { id: "send", label: "Send reminder" },
              ]}
            />

            {tab === "users" && <UsersPanel users={data.users} />}
            {tab === "parts" && <PartsPanel parts={data.parts} />}
            {tab === "send" && (
              <section className="card send-card" role="tabpanel" id="panel-send" aria-labelledby="tab-send">
                <div className="card__header card__header--bordered">
                  <div>
                    <h2 className="card__title">Send reminder</h2>
                    <p className="card__subtitle">It appears in each recipient&apos;s Reminders list, marked &quot;From manager&quot;.</p>
                  </div>
                </div>
                <SendReminderForm users={data.users} cars={data.cars} />
              </section>
            )}
          </div>
        </>
      )}
    </div>
  );
}
